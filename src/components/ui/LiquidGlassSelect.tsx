import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

export interface LiquidGlassOption<Value extends string> {
  value: Value
  label: string
}

interface LiquidGlassSelectProps<Value extends string> {
  id: string
  labelledBy: string
  value: Value
  options: Array<LiquidGlassOption<Value>>
  onChange: (value: Value) => void
  disabled?: boolean
}

interface MenuPosition {
  top?: number
  bottom?: number
  left: number
  width: number
  maxHeight: number
  placement: 'above' | 'below'
}

const VIEWPORT_MARGIN = 8
const MENU_GAP = 6
const MAX_MENU_HEIGHT = 320

export function LiquidGlassSelect<Value extends string>({
  id,
  labelledBy,
  value,
  options,
  onChange,
  disabled = false,
}: LiquidGlassSelectProps<Value>) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const menuId = `${id}-listbox`
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const selectedOption = options[selectedIndex]

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) {
      return
    }

    const rect = trigger.getBoundingClientRect()
    const availableBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN
    const availableAbove = rect.top - VIEWPORT_MARGIN
    const estimatedHeight = Math.min(
      MAX_MENU_HEIGHT,
      options.length * 42 + 12,
    )
    const placement =
      availableBelow >= Math.min(estimatedHeight, 180) ||
      availableBelow >= availableAbove
        ? 'below'
        : 'above'
    const availableHeight =
      (placement === 'below' ? availableBelow : availableAbove) - MENU_GAP
    const width = Math.min(
      Math.max(rect.width, 240),
      window.innerWidth - VIEWPORT_MARGIN * 2,
    )
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.left),
      window.innerWidth - width - VIEWPORT_MARGIN,
    )

    setMenuPosition({
      top: placement === 'below' ? rect.bottom + MENU_GAP : undefined,
      bottom:
        placement === 'above'
          ? window.innerHeight - rect.top + MENU_GAP
          : undefined,
      left,
      width,
      maxHeight: Math.max(96, Math.min(MAX_MENU_HEIGHT, availableHeight)),
      placement,
    })
  }, [options.length])

  const openMenu = (nextActiveIndex = selectedIndex) => {
    if (disabled) {
      return
    }
    updateMenuPosition()
    setActiveIndex(nextActiveIndex)
    setIsOpen(true)
  }

  const closeMenu = (restoreFocus = false) => {
    setIsOpen(false)
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }

  const selectOption = (index: number) => {
    const option = options[index]
    if (!option) {
      return
    }
    onChange(option.value)
    closeMenu(true)
  }

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex = Math.min(
        options.length - 1,
        Math.max(0, selectedIndex + direction),
      )
      openMenu(nextIndex)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (isOpen) {
        closeMenu()
      } else {
        openMenu()
      }
    }
  }

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) =>
        (current + direction + options.length) % options.length,
      )
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectOption(activeIndex)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu(true)
    } else if (event.key === 'Tab') {
      closeMenu()
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    menuRef.current?.focus()
    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        closeMenu()
      }
    }

    document.addEventListener('pointerdown', handleOutsidePointer)
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer)
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [isOpen, updateMenuPosition])

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="liquid-select__trigger"
        role="combobox"
        aria-labelledby={labelledBy}
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="liquid-select__value">{selectedOption?.label}</span>
        <ChevronDown
          className="liquid-select__chevron"
          data-open={isOpen}
          aria-hidden="true"
        />
      </button>

      {isOpen && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              className="liquid-select__menu"
              role="listbox"
              tabIndex={-1}
              aria-labelledby={labelledBy}
              aria-activedescendant={`${menuId}-option-${activeIndex}`}
              data-placement={menuPosition.placement}
              style={{
                top: menuPosition.top,
                bottom: menuPosition.bottom,
                left: menuPosition.left,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
              }}
              onKeyDown={handleMenuKeyDown}
            >
              {options.map((option, index) => (
                <button
                  key={option.value}
                  id={`${menuId}-option-${index}`}
                  type="button"
                  className="liquid-select__option"
                  role="option"
                  tabIndex={-1}
                  aria-selected={option.value === value}
                  data-active={index === activeIndex}
                  onPointerMove={() => setActiveIndex(index)}
                  onClick={() => selectOption(index)}
                >
                  <span>{option.label}</span>
                  {option.value === value ? (
                    <Check aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
