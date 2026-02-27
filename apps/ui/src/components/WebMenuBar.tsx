import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { eventBus } from '../platform';
import './WebMenuBar.css';

type MenuActionItem = { type: 'action'; id: string; label: string; shortcut?: string };
type MenuSeparator = { type: 'separator' };
type MenuItemDef = MenuActionItem | MenuSeparator;
type MenuDef = { label: string; items: MenuItemDef[] };

function modKey(): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return isMac ? '\u2318' : 'Ctrl';
}

function getMenuBarDef(t: (key: string) => string): MenuDef[] {
  const mod = modKey();

  return [
    {
      label: t('menu.file'),
      items: [
        { type: 'action', id: 'file.new', label: t('menu.new'), shortcut: `${mod}+N` },
        { type: 'action', id: 'file.open', label: t('menu.open'), shortcut: `${mod}+O` },
        { type: 'action', id: 'file.save', label: t('menu.save'), shortcut: `${mod}+S` },
        { type: 'action', id: 'file.saveAs', label: t('menu.saveAs'), shortcut: `${mod}+\u21E7+S` },
        { type: 'separator' },
        { type: 'action', id: 'file.export', label: t('menu.export') },
        { type: 'separator' },
        { type: 'action', id: 'file.settings', label: t('settings.title'), shortcut: `${mod}+,` },
      ],
    },
    {
      label: t('menu.edit'),
      items: [
        { type: 'action', id: 'edit.undo', label: t('menu.undo'), shortcut: `${mod}+Z` },
        { type: 'action', id: 'edit.redo', label: t('menu.redo'), shortcut: `${mod}+\u21E7+Z` },
        { type: 'separator' },
        { type: 'action', id: 'edit.render', label: t('preview.render'), shortcut: `${mod}+\u23CE` },
      ],
    },
  ];
}

function MenuDropdown({
  items,
  onAction,
  onClose,
}: {
  items: MenuItemDef[];
  onAction: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="web-menubar__dropdown">
      {items.map((item, idx) => {
        if (item.type === 'separator') {
          return (
            <div
              key={`sep-${item.type}-after-${idx > 0 ? (items[idx - 1] as MenuActionItem).id : 'start'}`}
              className="web-menubar__separator"
            />
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            className="web-menubar__item"
            onClick={() => {
              onAction(item.id);
              onClose();
            }}
          >
            <span className="web-menubar__item-label">{item.label}</span>
            {item.shortcut && <span className="web-menubar__item-shortcut">{item.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}

interface WebMenuBarProps {
  onExport: () => void;
  onSettings: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function WebMenuBar({ onExport, onSettings, onUndo, onRedo }: WebMenuBarProps) {
  const { t } = useTranslation();
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const menuDef = useMemo(() => getMenuBarDef(t), [t]);

  const handleClose = useCallback(() => {
    setOpenMenu(null);
  }, []);

  const handleAction = useCallback(
    (id: string) => {
      switch (id) {
        case 'file.new':
          eventBus.emit('menu:file:new');
          break;
        case 'file.open':
          eventBus.emit('menu:file:open');
          break;
        case 'file.save':
          eventBus.emit('menu:file:save');
          break;
        case 'file.saveAs':
          eventBus.emit('menu:file:save_as');
          break;
        case 'file.export':
          onExport();
          break;
        case 'file.settings':
          onSettings();
          break;
        case 'edit.undo':
          onUndo();
          break;
        case 'edit.redo':
          onRedo();
          break;
        case 'edit.render':
          eventBus.emit('render-requested');
          break;
      }
    },
    [onExport, onSettings, onUndo, onRedo]
  );

  useEffect(() => {
    if (openMenu === null) return;

    const onClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [openMenu]);

  return (
    <div className="web-menubar" ref={barRef}>
      <div className="web-menubar__menus">
        {menuDef.map((menu, i) => (
          <div key={menu.label} className="web-menubar__menu-wrapper">
            <button
              type="button"
              className={`web-menubar__trigger ${openMenu === i ? 'web-menubar__trigger--active' : ''}`}
              onClick={() => setOpenMenu(openMenu === i ? null : i)}
              onMouseEnter={() => {
                if (openMenu !== null) setOpenMenu(i);
              }}
            >
              {menu.label}
            </button>
            {openMenu === i && (
              <MenuDropdown items={menu.items} onAction={handleAction} onClose={handleClose} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
