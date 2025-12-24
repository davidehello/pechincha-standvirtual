"use client";

import { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  options: Option[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
}

export function Select({
  label,
  options,
  value,
  onChange,
  placeholder = "Select...",
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="text-sm font-medium">{label}</label>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-full px-3 py-2 text-sm border border-border rounded-md bg-background hover:bg-muted/50 transition-colors text-left"
        >
          <span className={!value ? "text-muted-foreground" : ""}>
            {selectedOption?.label ?? placeholder}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-hidden">
            {/* Options list */}
            <div className="overflow-y-auto max-h-52">
              {/* Clear option */}
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  setIsOpen(false);
                }}
                className={`flex items-center w-full px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left ${
                  !value ? "bg-muted/30" : ""
                }`}
              >
                <span className="text-muted-foreground">{placeholder}</span>
              </button>
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex items-center w-full px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left ${
                    value === option.value ? "bg-muted/30" : ""
                  }`}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
