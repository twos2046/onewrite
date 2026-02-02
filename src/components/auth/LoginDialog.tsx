import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { sendPhoneOTP, verifyPhoneOTP } from "@/db/api";
import { BRAND_NAME } from "@/config/brand";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoginSuccess?: () => void;
}

export function LoginDialog({ open, onOpenChange, onLoginSuccess }: LoginDialogProps) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [previousOpen, setPreviousOpen] = useState(false);

  // 从URL获取邀请码
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteParam = urlParams.get('invite');
    if (inviteParam) {
      setInviteCode(inviteParam);
      console.log('[邀请系统] 从URL获取邀请码:', inviteParam);
    }
  }, []);

  // 监听弹窗关闭事件
  useEffect(() => {
    // 当弹窗从打开变为关闭时
    if (previousOpen && !open) {
      // 显示提醒
      toast.warning("未登录用户无法正常保存数据哦！", {
        duration: 3000,
      });
    }
    setPreviousOpen(open);
  }, [open, previousOpen]);

  // 验证手机号格式
  const validatePhone = (phone: string) => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  };

  // 发送验证码
  const handleSendOTP = async () => {
    if (!validatePhone(phone)) {
      toast.error("请输入正确的手机号");
      return;
    }

    setLoading(true);
    try {
      await sendPhoneOTP(phone);
      toast.success("验证码已发送");
      setStep("otp");
      
      // 开始倒计时
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      console.error("发送验证码失败:", error);
      
      // 根据错误类型提供更友好的提示
      let errorMessage = "发送验证码失败，请重试";
      
      if (error.message?.includes("Failed to fetch") || error.name === "AuthRetryableFetchError") {
        errorMessage = "验证码服务暂时不可用，请稍后再试或联系管理员";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage, {
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  // 验证登录
  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error("请输入6位验证码");
      return;
    }

    console.log('🔐 [登录验证] 开始验证验证码...');
    setLoading(true);
    
    try {
      console.log('🔐 [登录验证] 调用verifyPhoneOTP...');
      
      // 添加超时保护，防止永久卡住
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('验证超时，请重试')), 30000); // 30秒超时
      });
      
      const verifyPromise = verifyPhoneOTP(phone, otp, inviteCode || undefined);
      
      await Promise.race([verifyPromise, timeoutPromise]);
      console.log('✅ [登录验证] verifyPhoneOTP成功');
      
      // 等待500ms，确保session已保存到localStorage
      console.log('⏳ [登录验证] 等待session保存到localStorage...');
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('✅ [登录验证] session保存完成');
      
      // 先设置previousOpen为false，避免触发关闭提醒
      setPreviousOpen(false);
      
      // 重置状态
      setPhone("");
      setOtp("");
      setInviteCode("");
      setStep("phone");
      
      // 关闭弹窗
      console.log('🔐 [登录验证] 关闭登录弹窗');
      onOpenChange(false);
      
      // 调用登录成功回调，让父组件刷新状态
      if (onLoginSuccess) {
        console.log('🔐 [登录验证] 调用onLoginSuccess回调...');
        try {
          await onLoginSuccess();
          console.log('✅ [登录验证] onLoginSuccess回调完成');
        } catch (callbackError) {
          console.error('❌ [登录验证] onLoginSuccess回调失败:', callbackError);
          // 即使回调失败，也不影响登录流程
        }
      }
      
      // 显示登录成功和奖励信息
      if (inviteCode) {
        toast.success(`登录成功！欢迎加入${BRAND_NAME}，您已获得100码分注册奖励！`, {
          duration: 5000,
        });
      } else {
        toast.success("登录成功！");
      }
      
      console.log('✅ [登录验证] 登录流程完成');
    } catch (error: any) {
      console.error("❌ [登录验证] 验证失败:", error);
      toast.error(error.message || "验证码错误，请重试");
    } finally {
      console.log('🔐 [登录验证] 重置loading状态');
      setLoading(false);
    }
  };

  // 重新发送验证码
  const handleResendOTP = () => {
    setStep("phone");
    setOtp("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            {step === "phone" ? "手机号登录" : "输入验证码"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === "phone" 
              ? "请输入您的手机号，我们将发送验证码" 
              : `验证码已发送至 ${phone}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === "phone" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">手机号</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="请输入手机号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={11}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inviteCode">邀请码（选填）</Label>
                <Input
                  id="inviteCode"
                  type="text"
                  placeholder="输入邀请码可获得额外奖励"
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
              <Button 
                onClick={handleSendOTP} 
                disabled={loading || !phone}
                className="w-full"
              >
                {loading ? "发送中..." : "获取验证码"}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="otp">验证码</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="请输入6位验证码"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  maxLength={6}
                />
              </div>
              <Button 
                onClick={handleVerifyOTP} 
                disabled={loading || !otp}
                className="w-full"
              >
                {loading ? "验证中..." : "登录"}
              </Button>
              <div className="text-center text-sm">
                {countdown > 0 ? (
                  <span className="text-muted-foreground">
                    {countdown}秒后可重新发送
                  </span>
                ) : (
                  <Button
                    variant="link"
                    onClick={handleResendOTP}
                    className="p-0 h-auto"
                  >
                    重新发送验证码
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
