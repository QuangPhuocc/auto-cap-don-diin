import { BarChart3, FilePlus2, Files, LogOut, Menu, Sheet, Users, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import { Button } from "./ui";

const links = [
  { to: "/", label: "Tổng quan", icon: BarChart3 },
  { to: "/policies/new", label: "Tạo đơn lẻ", icon: FilePlus2 },
  { to: "/policies", label: "Danh sách đơn", icon: Files }
];

export function AppLayout() {
  const { user, logout } = useAuth(); const [open, setOpen] = useState(false);
  const nav = [...links, ...(user?.role === "ADMIN" || user?.role === "MANAGER" ? [{ to: "/users", label: "Quản lý tài khoản", icon: Users }] : [])];
  return <div className="min-h-screen bg-stone-50">
    <aside className={cn("fixed inset-y-0 left-0 z-40 w-64 border-r bg-white transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex h-16 items-center justify-between border-b px-5"><div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-lg font-black text-white">D</div><div><div className="font-bold">DIIN Portal</div><div className="text-xs text-muted-foreground">Bảo hiểm TNDS</div></div></div><Button className="lg:hidden" variant="ghost" size="icon" onClick={()=>setOpen(false)}><X size={18}/></Button></div>
      <nav className="space-y-1 p-3">{nav.map(({to,label,icon:Icon})=><NavLink key={to} to={to} end={to==="/"} onClick={()=>setOpen(false)} className={({isActive})=>cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",isActive?"bg-orange-50 text-orange-700":"text-stone-600 hover:bg-stone-100")}><Icon size={18}/>{label}</NavLink>)}</nav>
      <div className="absolute inset-x-3 bottom-3 rounded-xl bg-stone-100 p-3"><div className="truncate text-sm font-semibold">{user?.fullName}</div><div className="mb-2 truncate text-xs text-muted-foreground">{user?.username} · {user?.role}</div><Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}><LogOut size={16}/>Đăng xuất</Button></div>
    </aside>
    <div className="lg:pl-64"><header className="sticky top-0 z-30 flex h-16 items-center border-b bg-white/90 px-4 backdrop-blur lg:px-8"><Button className="mr-3 lg:hidden" variant="ghost" size="icon" onClick={()=>setOpen(true)}><Menu size={20}/></Button><div><h1 className="font-semibold">Phát hành bảo hiểm Bắt buộc TNDS hãng Viễn Đông</h1><p className="text-xs text-muted-foreground">CTV tự chịu trách nhiệm cho mọi thông tin thẻ bảo hiểm được phát hành.</p></div></header><main className="p-4 lg:p-8"><Outlet/></main></div>
    {open && <button aria-label="Đóng menu" className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={()=>setOpen(false)}/>} 
  </div>;
}
