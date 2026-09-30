import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { Download, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  getPwaInstallServerSnapshot,
  getPwaInstallSnapshot,
  isAndroidBrowser,
  isIosBrowser,
  parseInstallOffer,
  promptPwaInstall,
  shouldShowInstallOffer,
  snoozeInstallOffer,
  subscribePwaInstall,
  type InstallOfferRecord,
} from '@/lib/pwa-install';

const STORAGE_KEY = 'azarmehr-install-offer';

function readRecord(): InstallOfferRecord | null {
  try {
    return parseInstallOffer(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeRecord(record: InstallOfferRecord) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* Private mode can block storage; the card just returns next visit. */
  }
}

export function InstallHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const ios = typeof navigator !== 'undefined' && isIosBrowser();
  const android = typeof navigator !== 'undefined' && isAndroidBrowser();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="app-dialog">
        <DialogTitle>نصب دفتر کلاسی</DialogTitle>
        <DialogDescription>روی ویندوز و گوشی مثل یک برنامهٔ جدا باز می‌شود و از نوار مرورگر خلاص می‌شوید. ورود و داده‌ها همان حساب مدرسه است.</DialogDescription>
        {ios ? (
          <ol className="install-steps">
            <li>در سافاری دکمهٔ اشتراک (مربع با فلش به‌بالا) را بزنید.</li>
            <li>گزینهٔ «افزودن به صفحهٔ اصلی» را انتخاب کنید.</li>
            <li>نام «دفتر آذرمهر» را تأیید کنید تا میانبر روی صفحهٔ اصلی بیاید.</li>
          </ol>
        ) : (
          <div className="stack">
            {!android && (
              <div>
                <b>ویندوز (کروم یا اج)</b>
                <ol className="install-steps">
                  <li>منوی سه‌نقطه یا سه‌خط مرورگر را باز کنید.</li>
                  <li>در اج: برنامه‌ها، سپس «نصب این سایت به‌عنوان برنامه».</li>
                  <li>در کروم: «نصب دفتر آذرمهر» یا Install app.</li>
                  <li>تأیید کنید تا میانبر روی میزکار و منوی استارت ساخته شود.</li>
                </ol>
              </div>
            )}
            <div>
              <b>اندروید</b>
              <ol className="install-steps">
                <li>منوی کروم را باز کنید.</li>
                <li>«نصب برنامه» یا «افزودن به صفحهٔ اصلی» را بزنید.</li>
              </ol>
            </div>
            <p>اگر دکمهٔ نصب در خود صفحه ظاهر شد همان را بزنید؛ مرورگر پنجرهٔ رسمی نصب را باز می‌کند.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const { installed, prompt } = useSyncExternalStore(subscribePwaInstall, getPwaInstallSnapshot, getPwaInstallServerSnapshot);
  const [help, setHelp] = useState(false);
  if (installed) return null;
  async function install() {
    const outcome = await promptPwaInstall();
    if (outcome === 'unavailable') setHelp(true);
  }
  const label = prompt ? 'نصب اپلیکیشن' : 'نصب روی ویندوز و موبایل';
  return (
    <>
      <button type="button" className="btn" onClick={() => void install()}>
        <Download size={16} />
        {compact ? 'نصب' : label}
      </button>
      <InstallHelpDialog open={help} onOpenChange={setHelp} />
    </>
  );
}

export function InstallOffer() {
  const titleId = useId();
  const { installed, prompt } = useSyncExternalStore(subscribePwaInstall, getPwaInstallSnapshot, getPwaInstallServerSnapshot);
  const [known, setKnown] = useState(false);
  const [ios, setIos] = useState(false);
  const [record, setRecord] = useState<InstallOfferRecord | null>(null);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    setRecord(readRecord());
    setIos(isIosBrowser());
    setKnown(true);
  }, []);

  if (!known || installed || !shouldShowInstallOffer(record, Date.now())) return null;

  function snooze() {
    const next = snoozeInstallOffer(record, Date.now());
    writeRecord(next);
    setRecord(next);
  }

  async function install() {
    const outcome = await promptPwaInstall();
    if (outcome === 'accepted') {
      writeRecord({ dismissals: record?.dismissals ?? 0, snoozeUntil: Date.now() + 365 * 24 * 60 * 60 * 1000 });
      setKnown(false);
      return;
    }
    if (outcome === 'dismissed') {
      snooze();
      return;
    }
    setHelp(true);
  }

  const title = prompt ? 'دفتر آذرمهر را مثل برنامه نصب کنید' : ios ? 'اشتراک، سپس افزودن به صفحهٔ اصلی' : 'نصب روی ویندوز و گوشی';
  return (
    <>
      <aside className="install-offer" aria-labelledby={titleId}>
        <b id={titleId}>{title}</b>
        <button type="button" className="btn primary" onClick={() => void install()}>{prompt ? 'نصب اپلیکیشن' : 'راهنمای نصب'}</button>
        <button type="button" className="icon-btn" aria-label="بعداً" onClick={snooze}><X size={16} /></button>
      </aside>
      <InstallHelpDialog open={help} onOpenChange={setHelp} />
    </>
  );
}
