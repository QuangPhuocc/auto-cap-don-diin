import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { useAuth } from "./context/AuthContext";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { NewPolicyPage } from "./pages/NewPolicyPage";
import { PoliciesPage } from "./pages/PoliciesPage";
import { UploadPage } from "./pages/UploadPage";
import { UsersPage } from "./pages/UsersPage";

function Protected(){const{user,loading}=useAuth();if(loading)return <div className="grid min-h-screen place-items-center">Đang tải…</div>;return user?<AppLayout/>:<Navigate to="/login" replace/>}
function AdminOnly(){const{user}=useAuth();return user?.role==="ADMIN"?<UsersPage/>:<Navigate to="/" replace/>}
export default function App(){return <Routes><Route path="/login" element={<LoginPage/>}/><Route element={<Protected/>}><Route index element={<DashboardPage/>}/><Route path="policies" element={<PoliciesPage/>}/><Route path="policies/new" element={<NewPolicyPage/>}/><Route path="policies/upload" element={<UploadPage/>}/><Route path="users" element={<AdminOnly/>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes>}
