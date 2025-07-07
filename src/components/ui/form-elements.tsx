import * as React from "react"
import { cn } from "../../lib/utils"
import { Input } from "./input"
import { Button } from "./button"
import { Textarea } from "./textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

// Form Group Component
export interface FormGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string
  error?: string
  required?: boolean
  helpText?: string
}

const FormGroup = React.forwardRef<HTMLDivElement, FormGroupProps>(
  ({ className, label, error, required, helpText, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("space-y-2", className)}
        {...props}
      >
        {label && (
          <label className="text-sm font-medium text-[#ffffff] flex items-center gap-1">
            {label}
            {required && <span className="text-red-400">*</span>}
          </label>
        )}
        {children}
        {helpText && !error && (
          <p className="text-xs text-[#ffffff]/60">{helpText}</p>
        )}
        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-400 flex-shrink-0" />
            {error}
          </p>
        )}
      </div>
    )
  }
)
FormGroup.displayName = "FormGroup"

// Search Input Component
export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void
  loading?: boolean
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onSearch, loading, ...props }, ref) => {
    const [value, setValue] = React.useState("")

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      onSearch?.(value)
    }

    return (
      <form onSubmit={handleSubmit} className="relative">
        <Input
          ref={ref}
          type="search"
          variant="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={cn("pr-10", className)}
          {...props}
        />
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          disabled={loading}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-[#1dff00]/20"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-[#1dff00] border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </Button>
      </form>
    )
  }
)
SearchInput.displayName = "SearchInput"

// Password Input Component
export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  showStrength?: boolean
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showStrength, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const [strength, setStrength] = React.useState(0)

    const calculateStrength = (password: string) => {
      let score = 0
      if (password.length >= 8) score++
      if (/[a-z]/.test(password)) score++
      if (/[A-Z]/.test(password)) score++
      if (/[0-9]/.test(password)) score++
      if (/[^A-Za-z0-9]/.test(password)) score++
      return score
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      if (showStrength) {
        setStrength(calculateStrength(value))
      }
      props.onChange?.(e)
    }

    const getStrengthColor = (score: number) => {
      if (score <= 1) return "bg-red-500"
      if (score <= 2) return "bg-yellow-500"
      if (score <= 3) return "bg-blue-500"
      return "bg-green-500"
    }

    const getStrengthText = (score: number) => {
      if (score <= 1) return "Weak"
      if (score <= 2) return "Fair"
      if (score <= 3) return "Good"
      return "Strong"
    }

    return (
      <div className="space-y-2">
        <div className="relative">
          <Input
            ref={ref}
            type={showPassword ? "text" : "password"}
            variant="password"
            className={cn("pr-10", className)}
            onChange={handleChange}
            {...props}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-[#ffffff]/20"
          >
            {showPassword ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </Button>
        </div>
        
        {showStrength && props.value && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors duration-300",
                    level <= strength ? getStrengthColor(strength) : "bg-[#ffffff]/20"
                  )}
                />
              ))}
            </div>
            <p className={cn(
              "text-xs font-medium",
              strength <= 1 ? "text-red-400" :
              strength <= 2 ? "text-yellow-400" :
              strength <= 3 ? "text-blue-400" : "text-green-400"
            )}>
              Password strength: {getStrengthText(strength)}
            </p>
          </div>
        )}
      </div>
    )
  }
)
PasswordInput.displayName = "PasswordInput"

// Number Input Component
export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  min?: number
  max?: number
  step?: number
  showControls?: boolean
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, min, max, step = 1, showControls = true, ...props }, ref) => {
    const [value, setValue] = React.useState(props.value || "")

    const increment = () => {
      const currentValue = parseFloat(value.toString()) || 0
      const newValue = currentValue + step
      if (max === undefined || newValue <= max) {
        setValue(newValue)
        props.onChange?.({ target: { value: newValue.toString() } } as any)
      }
    }

    const decrement = () => {
      const currentValue = parseFloat(value.toString()) || 0
      const newValue = currentValue - step
      if (min === undefined || newValue >= min) {
        setValue(newValue)
        props.onChange?.({ target: { value: newValue.toString() } } as any)
      }
    }

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="number"
          variant="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            props.onChange?.(e)
          }}
          className={cn(showControls && "pr-16", className)}
          {...props}
        />
        
        {showControls && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={increment}
              className="h-4 w-6 p-0 hover:bg-[#1dff00]/20"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={decrement}
              className="h-4 w-6 p-0 hover:bg-[#1dff00]/20"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Button>
          </div>
        )}
      </div>
    )
  }
)
NumberInput.displayName = "NumberInput"

export { FormGroup, SearchInput, PasswordInput, NumberInput }