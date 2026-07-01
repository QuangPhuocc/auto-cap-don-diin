import { BarChart3, FilePlus2, Files, LogOut, Menu, Sheet, Users, X, User } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import { Button } from "./ui";

const links = [
  { to: "/", label: "Tổng quan", icon: BarChart3 },
  { to: "/policies/new", label: "Tạo đơn", icon: FilePlus2 },
  { to: "/policies", label: "Danh sách đơn", icon: Files },
  { to: "/profile", label: "Tài khoản", icon: User }
];

const roleText: Record<string, string> = {
  CTV: "Cộng tác viên",
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý"
};

export function AppLayout() {
  const { user, logout } = useAuth(); const [open, setOpen] = useState(false);
  const nav = [...links, ...(user?.role === "ADMIN" || user?.role === "MANAGER" ? [{ to: "/users", label: "Quản lý tài khoản", icon: Users }] : [])];
  
  return <div className="min-h-screen bg-stone-50">
    <aside className={cn("fixed inset-y-0 left-0 z-40 border-r bg-white transition-all duration-300 flex flex-col justify-between group overflow-hidden", open ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0 w-16 lg:hover:w-64")}>
      <div>
        <div className="flex h-16 items-center justify-between border-b px-3.5">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-lg font-black text-white">D</div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
              <div className="font-bold">DIIN Portal</div>
              <div className="text-xs text-muted-foreground">Bảo hiểm TNDS</div>
            </div>
          </div>
          <Button className="lg:hidden" variant="ghost" size="icon" onClick={()=>setOpen(false)}><X size={18}/></Button>
        </div>
        <nav className="space-y-1 p-2">
          {nav.map(({to,label,icon:Icon})=>(
            <NavLink key={to} to={to} end={to==="/"} onClick={()=>setOpen(false)} className={({isActive})=>cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap",isActive?"bg-orange-50 text-orange-700":"text-stone-600 hover:bg-stone-100")}>
              <Icon size={18} className="shrink-0" />
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      
      <div className="m-2 rounded-xl bg-stone-100 p-2 overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-orange-100 text-sm font-bold text-orange-700">
            {user?.fullName?.charAt(0).toUpperCase()}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 min-w-0">
            <div className="truncate text-xs font-semibold">{user?.fullName}</div>
            <div className="truncate text-[10px] text-muted-foreground">{user?.phone || "Chưa có SĐT"}</div>
            <div className="truncate text-[9px] font-medium text-orange-600 uppercase">{roleText[user?.role ?? ""] || user?.role}</div>
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-2">
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs p-1 h-8" onClick={logout}>
            <LogOut size={14} className="mr-1" />Đăng xuất
          </Button>
        </div>
      </div>
    </aside>
    <div className="lg:pl-16 transition-all duration-300">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-white/90 px-4 backdrop-blur lg:px-8">
        <Button className="mr-3 lg:hidden" variant="ghost" size="icon" onClick={()=>setOpen(true)}><Menu size={20}/></Button>
        <div>
          <h1 className="font-semibold">Phát hành bảo hiểm Bắt buộc TNDS hãng Viễn Đông</h1>
          <p className="text-xs text-muted-foreground">CTV tự chịu trách nhiệm cho mọi thông tin thẻ bảo hiểm được phát hành.</p>
        </div>
      </header>
      <main className="p-4 lg:p-8"><Outlet/></main>
    </div>
    {open && <button aria-label="Đóng menu" className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={()=>setOpen(false)}/>} 
  </div>;
}
