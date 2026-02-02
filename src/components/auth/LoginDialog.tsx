import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { loginWithEmail, registerWithEmail, resendSignupEmail } from "@/db/api";
import { BRAND_NAME } from "@/config/brand";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoginSuccess?: () => void;
}

type AuthMode = "login" | "register";

export function LoginDialog({ open, onOpenChange, onLoginSuccess }: LoginDialogProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [previousOpen, setPreviousOpen] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteParam = urlParams.get("invite");
    if (inviteParam) {
      setInviteCode(inviteParam.toUpperCase());
      console.log("[邀请系统] 从URL获取邀请码:", inviteParam);
    }
  }, []);

  useEffect(() => {
    if (previousOpen && !open) {
      toast.warning("未登录用户无法正常保存数据哦！", {
        duration: 3000,
      });
    }
    setPreviousOpen(open);
  }, [open, previousOpen]);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setInviteCode("");
    setShowResend(false);
  };

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleAuthSuccess = async (showRewardToast?: boolean) => {
    setPreviousOpen(false);
    resetForm();
    onOpenChange(false);

    if (onLoginSuccess) {
      try {
        await onLoginSuccess();
      } catch (callbackError) {
        console.error("❌ [登录验证] onLoginSuccess回调失败:", callbackError);
      }
    }

    if (showRewardToast) {
      toast.success(`登录成功！欢迎加入${BRAND_NAME}，您已获得100码分注册奖励！`, {
        duration: 5000,
      });
    } else {
      toast.success("登录成功！");
    }
  };

  const handleLogin = async () => {
    if (!validateEmail(email)) {
      toast.error("请输入正确的邮箱");
      return;
    }
    if (!password || password.length < 6) {
      toast.error("请输入至少6位密码");
      return;
    }

    setLoading(true);
    setShowResend(false);
    try {
      await loginWithEmail(email.trim(), password);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await handleAuthSuccess(false);
    } catch (error: any) {
      console.error("❌ [邮箱登录] 失败:", error);
      if (String(error.message || "").includes("Invalid login credentials")) {
        toast.error("登录失败：请确认邮箱已完成验证，或检查密码是否正确。");
        setShowResend(true);
      } else {
        toast.error(error.message || "登录失败，请重试");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!validateEmail(email)) {
      toast.error("请输入正确的邮箱");
      return;
    }
    if (!password || password.length < 6) {
      toast.error("密码至少6位");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      const result = await registerWithEmail(email.trim(), password, inviteCode || undefined);
      if (result.session) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        await handleAuthSuccess(Boolean(inviteCode));
      } else {
        toast.success("注册成功！请查收邮箱完成验证后登录。", { duration: 5000 });
        setMode("login");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (error: any) {
      console.error("❌ [邮箱注册] 失败:", error);
      toast.error(error.message || "注册失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            {mode === "login" ? "邮箱登录" : "邮箱注册"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {mode === "login"
              ? "使用邮箱与密码登录"
              : "注册后即可开始创作"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={mode === "login" ? "default" : "outline"}
              onClick={() => setMode("login")}
              className="w-full"
            >
              登录
            </Button>
            <Button
              variant={mode === "register" ? "default" : "outline"}
              onClick={() => setMode("register")}
              className="w-full"
            >
              注册
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              placeholder="至少6位"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === "register" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认密码</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inviteCode">邀请码（选填）</Label>
                <Input
                  id="inviteCode"
                  type="text"
                  placeholder="输入邀请码可获得奖励"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={8}
                />
                {inviteCode && (
                  <p className="text-xs text-[#FF5724]">
                    使用邀请码注册可获得100码分奖励！
                  </p>
                )}
              </div>
            </>
          )}

          <Button
            onClick={mode === "login" ? handleLogin : handleRegister}
            disabled={loading || !email || !password}
            className="w-full"
          >
            {loading ? "处理中..." : mode === "login" ? "登录" : "注册并开始"}
          </Button>

          {mode === "login" && showResend && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!validateEmail(email)) {
                  toast.error("请输入正确的邮箱");
                  return;
                }
                setResending(true);
                try {
                  await resendSignupEmail(email.trim());
                  toast.success("验证邮件已重新发送，请检查邮箱");
                } catch (error: any) {
                  console.error("❌ [重发验证邮件] 失败:", error);
                  toast.error(error.message || "发送失败，请稍后重试");
                } finally {
                  setResending(false);
                }
              }}
              disabled={resending}
              className="w-full"
            >
              {resending ? "发送中..." : "重新发送验证邮件"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
