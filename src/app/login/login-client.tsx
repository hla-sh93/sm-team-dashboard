"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { loginAction } from "@/server/actions/auth";
import { Lock, ShieldCheck, Loader2 } from "lucide-react";

export default function LoginClient({
  configured,
  from,
}: {
  configured: boolean;
  from: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!configured && password !== confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    startTransition(async () => {
      const res = await loginAction(email, password);
      if (res.ok) {
        router.replace(from);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="bg-bg-card border border-border-soft rounded-2xl shadow-lg p-6 sm:p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center text-white shadow-sm shadow-accent/30 mb-3">
              {configured ? <Lock className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
            <h1 className="display-font text-xl">
              {configured ? "دخول لوحة الإدارة" : "تأمين لوحة الإدارة"}
            </h1>
            <p className="text-sm text-fg-dim mt-1">
              {configured
                ? "أدخل كلمة مرور الإدارة للمتابعة"
                : "أنشئ كلمة مرور لحماية المالية والفريق والإعدادات"}
            </p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 text-left"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">
                {configured ? "كلمة المرور" : "كلمة المرور الجديدة"}
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete={configured ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
                required
              />
            </div>

            {!configured && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-11"
                  required
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-1"
              disabled={pending}
            >
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              {configured ? "دخول" : "حفظ ودخول"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-fg-muted mt-4 leading-relaxed">
          منطقة الموظفين لا تتطلب دخولاً — هذه الحماية للوحة الإدارة فقط.
        </p>
      </div>
    </div>
  );
}
