/**
 * OpenSCAD Customizer Parameter Parser
 *
 * Parses OpenSCAD source code to extract customizer parameters using tree-sitter.
 * Supports the official OpenSCAD customizer syntax.
 */

import type * as TreeSitter from 'web-tree-sitter'
import { parse } from '../formatter/parser'
import type { CustomizerParam, CustomizerTab, DropdownOption, ParameterType } from './types'

interface ExtractedValue {
  value: string | number | boolean | number[]
  rawValue: string
  inferredType: ParameterType
}

/**
 * Parse comment text to extract customizer configuration
 * Examples:
 *   "// [0:100]" -> slider with range 0-100
 *   "// [0:5:100]" -> slider with step 5
 *   "// [foo, bar, baz]" -> dropdown with string options
 *   "// [10:Small, 20:Medium, 30:Large]" -> dropdown with labeled values
 */
function parseCommentConfig(comment: string): {
  type: ParameterType
  description?: string
  min?: number
  max?: number
  step?: number
  options?: DropdownOption[]
} | null {
  // Extract content between [ and ]
  const match = comment.match(/\[([^\]]+)\]/)
  if (!match) return null

  const content = match[1].trim()
  const description = comment.slice(0, match.index).trim()

  // Check for labeled dropdown: "10:Small, 20:Medium"
  if (content.includes(':') && content.includes(',')) {
    const parts = content.split(',').map((s) => s.trim())
    if (parts.every((p) => p.includes(':'))) {
      const options = parts.map((part) => {
        const separatorIndex = part.indexOf(':')
        const val = part.slice(0, separatorIndex).trim()
        const label = part.slice(separatorIndex + 1).trim()
        const numericValue = Number(val)
        return {
          value: Number.isFinite(numericValue) ? numericValue : val,
          label: label || val,
        }
      })
      return { type: 'dropdown', description, options }
    }
  }

  // Check for range with step: "0:5:100"
  const rangeStepMatch = content.match(/^(-?\d+\.?\d*):(-?\d+\.?\d*):(-?\d+\.?\d*)$/)
  if (rangeStepMatch) {
    return {
      type: 'slider',
      description,
      min: Number(rangeStepMatch[1]),
      step: Number(rangeStepMatch[2]),
      max: Number(rangeStepMatch[3]),
    }
  }

  // Check for range without step: "0:100"
  const rangeMatch = content.match(/^(-?\d+\.?\d*):(-?\d+\.?\d*)$/)
  if (rangeMatch) {
    return {
      type: 'slider',
      description,
      min: Number(rangeMatch[1]),
      max: Number(rangeMatch[2]),
    }
  }

  // Check for simple max value (slider from 0 to max): "100"
  if (/^-?\d+\.?\d*$/.test(content)) {
    return {
      type: 'slider',
      description,
      min: 0,
      max: Number(content),
    }
  }

  // Check for string dropdown: "foo, bar, baz"
  if (content.includes(',')) {
    const options = content
      .split(',')
      .map((s) => s.trim())
      .map((val) => ({
        value: val,
        label: val,
      }))
    return { type: 'dropdown', description, options }
  }

  return null
}

/**
 * Get contiguous leading line comments immediately above a node.
 * Example:
 *   // line one
 *   // line two
 *   foo = 1; // [0:10]
 *
 * Returns: "line one line two"
 */
function getLeadingDescription(node: TreeSitter.Node, sourceCode: string): string | undefined {
  const lines = sourceCode.split('\n')
  const descriptionLines: string[] = []
  let lineIndex = node.startPosition.row - 1

  while (lineIndex >= 0) {
    const trimmed = (lines[lineIndex] || '').trim()
    if (!trimmed.startsWith('//')) break

    const text = trimmed.replace(/^\/\/\s?/, '').trim()
    if (text.length > 0) {
      descriptionLines.unshift(text)
    }
    lineIndex -= 1
  }

  if (descriptionLines.length === 0) return undefined
  return descriptionLines.join(' ')
}

function extractValueFromText(rawValue: string): ExtractedValue | null {
  const text = rawValue.trim()

  if (text === 'true' || text === 'false') {
    return {
      value: text === 'true',
      rawValue,
      inferredType: 'boolean',
    }
  }

  if (text.startsWith('"') || text.startsWith("'")) {
    if (text.length < 2) return null
    return {
      value: text.replace(/^["']|["']$/g, ''),
      rawValue,
      inferredType: 'string',
    }
  }

  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return {
      value: Number(text),
      rawValue,
      inferredType: 'number',
    }
  }

  if (/^\[.*\]$/.test(text)) {
    const inner = text.slice(1, -1).trim()
    if (!inner) {
      return {
        value: [],
        rawValue,
        inferredType: 'vector',
      }
    }

    const parts = inner.split(',').map((item) => item.trim())
    if (parts.every((part) => /^-?\d+(\.\d+)?$/.test(part))) {
      return {
        value: parts.map(Number),
        rawValue,
        inferredType: 'vector',
      }
    }
  }

  return null
}

function parseCustomizerParamsFallback(sourceCode: string): CustomizerTab[] {
  const lines = sourceCode.split('\n')
  const params: CustomizerParam[] = []
  let currentTab = 'Parameters'
  let pendingDescriptionLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (/^(module|function)\b/.test(trimmed)) {
      break
    }

    const tabMatch = trimmed.match(/^\/\*\s*\[([^\]]+)\]\s*\*\/$/)
    if (tabMatch) {
      const tabName = tabMatch[1].trim()
      currentTab = tabName.toLowerCase() === 'hidden' ? '__hidden__' : tabName
      pendingDescriptionLines = []
      continue
    }

    if (trimmed.startsWith('//')) {
      const text = trimmed.replace(/^\/\/\s?/, '').trim()
      if (text) pendingDescriptionLines.push(text)
      continue
    }

    if (trimmed === '') {
      pendingDescriptionLines = []
      continue
    }

    const assignmentMatch = line.match(/^\s*([A-Za-z_]\w*)\s*=\s*([^;]+);\s*(?:\/\/(.*))?$/)
    if (!assignmentMatch) {
      pendingDescriptionLines = []
      continue
    }

    if (currentTab === '__hidden__') {
      pendingDescriptionLines = []
      continue
    }

    const [, name, rawValueText, trailingCommentRaw] = assignmentMatch
    const rawValue = rawValueText.trim()
    const extractedValue = extractValueFromText(rawValue)
    if (!extractedValue) {
      pendingDescriptionLines = []
      continue
    }

    const commentText = trailingCommentRaw?.trim() || null
    const commentConfig = commentText ? parseCommentConfig(commentText) : null
    const leadingDescription = pendingDescriptionLines.length > 0 ? pendingDescriptionLines.join(' ') : undefined

    const param: CustomizerParam = {
      name,
      value: extractedValue.value,
      rawValue,
      type: commentConfig?.type || extractedValue.inferredType,
      line: i + 1,
      tab: currentTab,
    }

    if (commentConfig) {
      if (leadingDescription || commentConfig.description) {
        param.description = leadingDescription || commentConfig.description
      }
      if (commentConfig.min !== undefined) param.min = commentConfig.min
      if (commentConfig.max !== undefined) param.max = commentConfig.max
      if (commentConfig.step !== undefined) param.step = commentConfig.step
      if (commentConfig.options) param.options = commentConfig.options
    } else if (leadingDescription) {
      param.description = leadingDescription
    }

    params.push(param)
    pendingDescriptionLines = []
  }

  const tabMap = new Map<string, CustomizerParam[]>()
  for (const param of params) {
    const tabName = param.tab || 'Parameters'
    if (!tabMap.has(tabName)) {
      tabMap.set(tabName, [])
    }
    tabMap.get(tabName)!.push(param)
  }

  const tabs: CustomizerTab[] = []
  for (const [name, tabParams] of tabMap.entries()) {
    tabs.push({ name, params: tabParams })
  }

  return tabs
}

function parseAssignmentFromLine(line: string): {
  name: string
  rawValue: string
  trailingComment: string | null
} | null {
  const assignmentMatch = line.match(/^\s*([A-Za-z_]\w*)\s*=\s*([^;]+);\s*(?:\/\/(.*))?$/)
  if (!assignmentMatch) return null

  const [, name, rawValueText, trailingCommentRaw] = assignmentMatch
  return {
    name,
    rawValue: rawValueText.trim(),
    trailingComment: trailingCommentRaw?.trim() || null,
  }
}

/**
 * Parse OpenSCAD source code and extract customizer parameters
 */
export function parseCustomizerParams(sourceCode: string): CustomizerTab[] {
  const tree = parse(sourceCode)
  if (!tree) {
    console.warn('[Customizer] Failed to parse code, falling back to line-based parser')
    return parseCustomizerParamsFallback(sourceCode)
  }

  const params: CustomizerParam[] = []
  let currentTab = 'Parameters' // Default tab name

  try {
    // Walk the root node
    const cursor = tree.walk()
    const rootNode = tree.rootNode

    // Look for top-level assignments before first module/function
    for (let i = 0; i < rootNode.childCount; i++) {
      const child = rootNode.child(i)
      if (!child) continue

      // Stop at first module or function declaration
      if (child.type === 'module_declaration' || child.type === 'function_declaration') {
        break
      }

      // Check for block (contains '{') - stop here as params must be before blocks
      if (child.type === 'block' || child.type === 'union_block') {
        break
      }

      // Look for tab/group comments: /* [Tab Name] */
      if (child.type === 'comment') {
        const commentText = sourceCode.substring(child.startIndex, child.endIndex)
        const tabMatch = commentText.match(/\/\*\s*\[([^\]]+)\]\s*\*\//)
        if (tabMatch) {
          const tabName = tabMatch[1].trim()
          // Skip [Hidden] tab
          if (tabName.toLowerCase() !== 'hidden') {
            currentTab = tabName
          } else {
            // Skip subsequent params until next tab
            currentTab = '__hidden__'
          }
          continue
        }
      }

      // Look for assignments: variable = value;
      if (child.type === 'assignment') {
        // Skip if in hidden tab
        if (currentTab === '__hidden__') continue

        const lineText = sourceCode.split('\n')[child.startPosition.row] || ''
        const assignment = parseAssignmentFromLine(lineText)
        if (!assignment) continue

        const { name, rawValue, trailingComment } = assignment
        const extractedValue = extractValueFromText(rawValue)
        if (!extractedValue) continue

        const { value, inferredType } = extractedValue
        const commentConfig = trailingComment ? parseCommentConfig(trailingComment) : null
        const leadingDescription = getLeadingDescription(child, sourceCode)

        const param: CustomizerParam = {
          name,
          value,
          rawValue,
          type: commentConfig?.type || inferredType,
          line: child.startPosition.row + 1, // 1-indexed
          tab: currentTab,
        }

        // Add range/options from comment if present
        if (commentConfig) {
          if (leadingDescription || commentConfig.description) {
            param.description = leadingDescription || commentConfig.description
          }
          if (commentConfig.min !== undefined) param.min = commentConfig.min
          if (commentConfig.max !== undefined) param.max = commentConfig.max
          if (commentConfig.step !== undefined) param.step = commentConfig.step
          if (commentConfig.options) param.options = commentConfig.options
        } else if (leadingDescription) {
          param.description = leadingDescription
        }

        params.push(param)
      }
    }

    cursor.delete()
  } finally {
    tree.delete()
  }

  // Group parameters by tab
  const tabMap = new Map<string, CustomizerParam[]>()
  for (const param of params) {
    const tabName = param.tab || 'Parameters'
    if (!tabMap.has(tabName)) {
      tabMap.set(tabName, [])
    }
    tabMap.get(tabName)!.push(param)
  }

  // Convert to array of tabs
  const tabs: CustomizerTab[] = []
  for (const [name, params] of tabMap.entries()) {
    tabs.push({ name, params })
  }

  if (tabs.length === 0) {
    return parseCustomizerParamsFallback(sourceCode)
  }

  return tabs
}
