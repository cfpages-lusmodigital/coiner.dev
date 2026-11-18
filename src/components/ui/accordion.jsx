import React, { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

const AccordionContext = createContext({
  activeItem: null,
  toggleItem: () => {},
});

const Accordion = ({
  type = "single",
  collapsible = true,
  defaultValue = null,
  className,
  children,
  ...props
}) => {
  const [activeItem, setActiveItem] = useState(defaultValue);

  const toggleItem = (value) => {
    if (activeItem === value) {
      if (collapsible) {
        setActiveItem(null);
      }
    } else {
      setActiveItem(value);
    }
  };

  return (
    <AccordionContext.Provider value={{ activeItem, toggleItem }}>
      <div className={cn("w-full space-y-2", className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
};

const AccordionItem = ({ value, className, children, ...props }) => {
  const { activeItem } = useContext(AccordionContext);
  const isOpen = activeItem === value;

  return (
    <div
      data-state={isOpen ? "open" : "closed"}
      className={cn("overflow-hidden rounded-xl", className)}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { itemValue: value, isOpen });
        }
        return child;
      })}
    </div>
  );
};

const AccordionTrigger = ({
  itemValue,
  isOpen,
  className,
  children,
  onClick,
  ...props
}) => {
  const { toggleItem } = useContext(AccordionContext);

  const handleClick = (e) => {
    if (onClick) onClick(e);
    if (itemValue) toggleItem(itemValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick(e);
    }
  };

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex w-full items-center justify-between py-3.5 text-left font-sans font-bold text-white transition-all cursor-pointer",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          "shrink-0 transition-transform duration-200 text-amber-400",
          isOpen ? "rotate-180" : "rotate-0"
        )}
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
};

const AccordionContent = ({ isOpen, className, children, ...props }) => {
  if (!isOpen) return null;

  return (
    <div
      data-state={isOpen ? "open" : "closed"}
      className={cn(
        "overflow-hidden text-sm leading-relaxed text-zinc-300 pb-4 pt-1 animate-fadeIn",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
