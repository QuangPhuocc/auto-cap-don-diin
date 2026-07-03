import { ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "../components/ui";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState(localStorage.getItem("remembered_username") || "");
  const [password, setPassword] = useState(localStorage.getItem("remembered_password") || "");

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const u = String(data.get("username"));
    const p = String(data.get("password"));
    try {
      await login(u, p);
      localStorage.setItem("remembered_username", u);
      localStorage.setItem("remembered_password", p);
      navigate("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đăng nhập thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_right,_#fed7aa,_transparent_35%),radial-gradient(circle_at_bottom_left,_#ffedd5,_transparent_30%)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-orange-500 text-white">
            <ShieldCheck size={30} />
          </div>
          <CardTitle className="text-2xl">Đăng nhập</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="username">Tên đăng nhập</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <Button className="w-full" disabled={busy}>
              {busy ? "Đang đăng nhập…" : "Đăng nhập"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

