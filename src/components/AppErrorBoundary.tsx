import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  diagnosticMessageAr: string;
  referenceCode?: string;
}

function formatSafeArabicDiagnostic(error: Error | null): {
  diagnosticMessageAr: string;
  referenceCode?: string;
} {
  if (!error || !error.message) {
    return {
      diagnosticMessageAr:
        'حدث تعارض تقني مؤقت أثناء تحميل هذه الواجهة، وتم عزل الخطأ بأمان لحماية بيانات حسابك وسجلك العائلي.',
    };
  }

  const raw = error.message.trim();

  // Decode structured FirestoreErrorInfo JSON payloads cleanly without exposing raw stack traces
  if (raw.startsWith('{') && raw.includes('"operationType"')) {
    try {
      const parsed = JSON.parse(raw) as {
        error?: string;
        operationType?: string;
        path?: string | null;
      };
      const isPermissionIssue =
        (parsed.error || '').includes('Missing or insufficient permissions') ||
        (parsed.error || '').includes('PERMISSION_DENIED');

      return {
        diagnosticMessageAr: isPermissionIssue
          ? 'تم رفض هذا الإجراء بموجب قواعد الحماية السحابية (Zero-Trust). يرجى التأكد من تسجيل الدخول بحساب صاحب السجل ثم المحاولة مجدداً.'
          : 'تعذر إتمام مزامنة السجل السحابي مؤقتاً. يرجى تحديث الصفحة والمحاولة مرة أخرى.',
        referenceCode: parsed.operationType
          ? `FS-${String(parsed.operationType).toUpperCase()}`
          : 'FS-GUARD',
      };
    } catch {
      // Fall through to generic heritage recovery message
    }
  }

  if (
    raw.includes('Missing or insufficient permissions') ||
    raw.includes('PERMISSION_DENIED')
  ) {
    return {
      diagnosticMessageAr:
        'هذا المسار محمي بقواعد صلاحيات صارمة لحماية خصوصية السجل العائلي. يرجى التحقق من جلسة الدخول الحالية.',
      referenceCode: 'AUTH-GUARD',
    };
  }

  return {
    diagnosticMessageAr:
      'حدث عارض تشغيلي غير متوقع أثناء عرض الواجهة، وتمت حماية جلستك وبياناتك المحفوظة بالكامل دون أي فقدان.',
    referenceCode: 'UI-SAFE-RECOVERY',
  };
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  public state: AppErrorBoundaryState = {
    hasError: false,
    diagnosticMessageAr: '',
    referenceCode: undefined,
  };

  public static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    const formatted = formatSafeArabicDiagnostic(error);
    return {
      hasError: true,
      diagnosticMessageAr: formatted.diagnosticMessageAr,
      referenceCode: formatted.referenceCode,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[Juthori Safe ErrorBoundary]', error, errorInfo);
  }

  private handleResetAndContinue = (): void => {
    this.setState({
      hasError: false,
      diagnosticMessageAr: '',
      referenceCode: undefined,
    });
  };

  private handleReturnHome = (): void => {
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  };

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#F5F1E8] text-[#1F1F1C] flex items-center justify-center p-6"
      >
        <div className="w-full max-w-lg bg-[#F5F1E8] border border-[#D97757]/40 rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-[#E8DED2] text-[#1F1F1C] px-7 py-5 border-b border-[#D8C7B2] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] flex items-center justify-center text-[#D97757]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-[#D97757] font-semibold">
                  منصة جذوري · نظام الحماية والاسترداد الآمن
                </div>
                <h1 className="text-lg font-bold text-[#1F1F1C] mt-0.5">
                  تم احتواء عارض تقني مؤقت بأمان
                </h1>
              </div>
            </div>
            {this.state.referenceCode && (
              <span
                dir="ltr"
                className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-[#FAF7F2] border border-[#D8C7B2] text-[#D97757]"
              >
                {this.state.referenceCode}
              </span>
            )}
          </div>

          <div className="p-7 space-y-5">
            <p className="text-sm leading-relaxed text-[#1F1F1C]">
              {this.state.diagnosticMessageAr}
            </p>

            <div className="bg-[#F5F1E8] border border-[#D8C7B2] rounded-xl p-4 text-xs text-[#1F1F1C]/70 leading-relaxed">
              تظل كافة سجلاتك النسبية، رصيد محفظتك، ووثائق خزانتك العائلية محفوظة
              بأمان في السحابة. يمكنك إعادة محاولة العرض فوراً أو العودة إلى
              الصفحة الرئيسية.
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={this.handleResetAndContinue}
                className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-sm font-bold transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة المحاولة الآن</span>
              </button>
              <button
                type="button"
                onClick={this.handleReturnHome}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-[#D97757]/50 hover:bg-[#F5F1E8] text-[#1F1F1C] text-sm font-bold transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>الصفحة الرئيسية</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
