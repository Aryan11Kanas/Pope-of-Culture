"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSidebar } from "./sidebar-provider"
import { cn } from "@/lib/utils"
import { LayoutDashboard, HelpCircle, Menu, Film, Search, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Sidebar() {
  const pathname = usePathname()
  const { isOpen, toggle } = useSidebar()

  return (
    <>
      <div
        className={cn("fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden", isOpen ? "block" : "hidden")}
        onClick={toggle}
      />
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-background",
          "transition-transform duration-300 ease-in-out",
          "border-r",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        )}
      >
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-lg font-semibold">Movie Recommender</span>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={toggle}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex flex-col h-[calc(100vh-3.5rem)]">
          <div className="flex-1 overflow-auto py-2">
            <nav className="grid gap-1 px-2">
              {navItems.map((item, index) => (
                <Link
                  key={index}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                    pathname === item.href ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>
          </div>
          <div className="border-t p-2">
            <nav className="grid gap-1">
              {footerItems.map((item, index) => (
                <Link
                  key={index}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                    pathname === item.href ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                  {item.description && (
                    <span className="ml-auto text-xs text-muted-foreground">{item.description}</span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </>
  )
}

const navItems = [
  { name: "Get Recommendations", href: "/dashboard", icon: Film },
  { name: "Get Analysis", href: "/analysis", icon: Search },
  { name: "Web Sentiments", href: "/sentiments", icon: MessageSquare },
  { name: "Recommendation History", href: "/recommendations", icon: LayoutDashboard },
]

const footerItems = [
  { name: "Help", href: "/help", icon: HelpCircle, description: "Get support" },
]
