"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { addAdminAction, removeAdminAction, resetAdminPasswordAction } from "@/server/actions/admins";
import type { ExtraAdmin } from "@/lib/auth";

export default function AdminsClient({ isOwner, admins }: { isOwner: boolean; admins: ExtraAdmin[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast(okMsg);
        after?.();
        router.refresh();
      } else toast(r.error ?? "فشل", "error");
    });

  return (
    <div className="flex flex-col gap-6">
      <header className="border-t-4 border-accent pt-3 -mt-3 rounded">
        <h1 className="display-font text-2xl flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
          المسؤولون
        </h1>
        <p className="text-sm text-fg-dim">
          حسابات دخول إضافية لواجهة الإدارة بنفس صلاحياتها. المسؤول الإضافي ما بيضيف ولا بيشيل
          مسؤولين، وما بيغيّر كلمة مرور المالكة. وحساب الإدارة ما بيعطي أي وصول للكود.
        </p>
      </header>

      {!isOwner ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          إدارة المسؤولين للمالكة فقط.
        </div>
      ) : (
        <>
          <section className="rounded-lg border border-border bg-bg-elev p-3 flex flex-col gap-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-accent" /> مسؤول جديد
            </h2>
            <form
              className="flex gap-2 flex-wrap items-center"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => addAdminAction({ name, email, password }), "انضاف المسؤول", () => {
                  setName("");
                  setEmail("");
                  setPassword("");
                });
              }}
            >
              <Input className="h-9 w-40 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" />
              <Input
                className="h-9 w-56 text-sm"
                type="email"
                dir="ltr"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
              <Input
                className="h-9 w-48 text-sm"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور (٨ أحرف على الأقل)"
              />
              <button disabled={busy} type="submit" className="h-9 px-3 rounded-md bg-accent text-bg text-sm disabled:opacity-50">
                إضافة
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-border bg-bg-elev p-3 flex flex-col gap-2">
            <h2 className="text-sm font-semibold">المسؤولون الإضافيون ({admins.length})</h2>
            {admins.length === 0 ? (
              <p className="text-[12px] text-fg-muted">ما في مسؤولين إضافيين لسا.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {admins.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm border-b border-border pb-2 last:border-0">
                    <span className="font-semibold">{a.name}</span>
                    <span className="font-mono text-fg-dim" dir="ltr">
                      {a.email}
                    </span>
                    <span className="text-[11px] text-fg-muted">
                      منذ {new Date(a.createdAt).toLocaleDateString("ar-SY", { timeZone: "Asia/Damascus" })}
                    </span>
                    <span className="flex-1" />
                    {resetFor === a.id ? (
                      <form
                        className="flex gap-2 items-center"
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(() => resetAdminPasswordAction(a.id, resetPassword), "تغيّرت كلمة المرور وانقطعت جلساته", () => {
                            setResetFor(null);
                            setResetPassword("");
                          });
                        }}
                      >
                        <Input
                          className="h-8 w-44 text-sm"
                          type="password"
                          dir="ltr"
                          autoComplete="new-password"
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          placeholder="كلمة مرور جديدة"
                        />
                        <button disabled={busy} type="submit" className="h-8 px-2 rounded-md bg-accent text-bg text-xs disabled:opacity-50">
                          حفظ
                        </button>
                        <button type="button" onClick={() => setResetFor(null)} className="h-8 px-2 rounded-md border border-border text-xs">
                          إلغاء
                        </button>
                      </form>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => setResetFor(a.id)}
                        className="h-8 px-2 rounded-md border border-border text-xs flex items-center gap-1"
                      >
                        <KeyRound className="w-3.5 h-3.5" /> كلمة مرور جديدة
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`حذف ${a.name}؟ جلساته بتنقطع فوراً.`)) run(() => removeAdminAction(a.id), "انحذف المسؤول");
                      }}
                      className="h-8 px-2 rounded-md border border-danger/40 text-danger text-xs flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> حذف
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
