/**
 * Slider UI component
 */

import React from 'react'

interface SliderProps {
  value: number[]
  onValueChange: (value: number[]) => void
  min?: number
  max?: number
  step?: number
  className?: string
  disabled?: boolean
  id?: string
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className = '',
  disabled = false,
  id
}: SliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    onValueChange([newValue])
  }

  return (
    <div className={`relative w-full ${className}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0] || 0}
        onChange={handleChange}
        disabled={disabled}
        id={id}
        className={`
          w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
          slider-thumb:appearance-none slider-thumb:h-4 slider-thumb:w-4 
          slider-thumb:rounded-full slider-thumb:bg-blue-600 slider-thumb:cursor-pointer
          slider-thumb:border-2 slider-thumb:border-white slider-thumb:shadow-md
          hover:slider-thumb:bg-blue-700
        `}
        style={{
          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((value[0] || 0) - min) / (max - min) * 100}%, #e5e7eb ${((value[0] || 0) - min) / (max - min) * 100}%, #e5e7eb 100%)`
        }}
      />
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}