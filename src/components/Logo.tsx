interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className = "", size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "h-12",
    md: "h-16",
    lg: "h-20",
  };

  return (
    <img src="/uploads/logo.webp" alt="Logo" className={`${sizeClasses[size]} w-auto object-contain ${className}`} />
  );
}
