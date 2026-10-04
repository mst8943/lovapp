type DeliveryResult = {
  sent: boolean;
  skipped: boolean;
  provider: "resend" | "netgsm";
  messageId?: string;
  error?: string;
};

type Applicant = {
  fullName: string;
  email: string;
  phoneE164: string;
  applicationCode: string;
};

export function normalizeTurkishMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("0090") ? digits.slice(4)
    : digits.startsWith("90") ? digits.slice(2)
      : digits.startsWith("0") ? digits.slice(1)
        : digits;
  return /^5\d{9}$/.test(national) ? `+90${national}` : null;
}

export async function sendApplicationReceipt(applicant: Applicant) {
  const firstName = applicant.fullName.trim().split(/\s+/)[0] || applicant.fullName;
  return Promise.all([
    sendResendEmail({
      to: applicant.email,
      name: applicant.fullName,
      subject: "Lovask başvurunuz alındı",
      text: `${firstName}, başvurunuz kurula iletildi. Başvuru kodunuz: ${applicant.applicationCode}. Profiliniz uygun bulunursa sizinle iletişime geçeceğiz.`,
      html: emailLayout("Başvurunuz kurula iletildi", `${escapeHtml(firstName)}, profiliniz değerlendirme sırasına alındı.`, applicant.applicationCode),
    }),
    sendNetgsmSms(applicant.phoneE164, `Lovask basvurunuz alindi. Basvuru kodunuz: ${applicant.applicationCode}. Sonucu e-posta ve SMS ile bildirecegiz.`),
  ]);
}

export async function sendApplicationDecision(applicant: Applicant, status: "approved" | "rejected") {
  const approved = status === "approved";
  const subject = approved ? "Lovask başvurunuz kabul edildi" : "Lovask başvurunuz sonuçlandı";
  const message = approved
    ? `Başvurunuz kurul tarafından kabul edildi. Kişisel davetiyeniz ayrıca gönderilecek. Kod: ${applicant.applicationCode}`
    : `Başvurunuz bu değerlendirme döneminde kabul edilmedi. Kod: ${applicant.applicationCode}`;
  return Promise.all([
    sendResendEmail({
      to: applicant.email,
      name: applicant.fullName,
      subject,
      text: message,
      html: emailLayout(subject, escapeHtml(message), applicant.applicationCode),
    }),
    sendNetgsmSms(applicant.phoneE164, asciiSms(`Lovask: ${message}`)),
  ]);
}

export function sendInvitationSms(applicant: Pick<Applicant, "phoneE164" | "applicationCode">) {
  return sendNetgsmSms(applicant.phoneE164, `Lovask davetiyeniz e-posta adresinize gonderildi. Kod: ${applicant.applicationCode}`);
}

export async function sendResendEmail(input: { to: string; name: string; subject: string; text: string; html: string }, provider?: { resendApiKey: string; resendFromEmail: string; resendFromName: string }): Promise<DeliveryResult> {
  const apiKey = provider?.resendApiKey ?? process.env.RESEND_API_KEY;
  const senderEmail = provider?.resendFromEmail ?? process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !senderEmail) return { sent: false, skipped: true, provider: "resend", error: "Resend yapılandırılmadı." };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "user-agent": "Lovask/1.0 (https://lovask.com.tr)",
      },
      body: JSON.stringify({
        from: `${provider?.resendFromName || process.env.RESEND_FROM_NAME || "Lovask"} <${senderEmail}>`,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
        tags: [{ name: "category", value: "membership_application" }],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const body = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
    if (!response.ok) return { sent: false, skipped: false, provider: "resend", error: body.message || body.name || `HTTP ${response.status}` };
    return { sent: true, skipped: false, provider: "resend", messageId: body.id };
  } catch (error) {
    return { sent: false, skipped: false, provider: "resend", error: error instanceof Error ? error.message : "Resend bağlantı hatası." };
  }
}

export async function sendNetgsmSms(phoneE164: string, message: string, provider?: { netgsmUsercode: string; netgsmPassword: string; netgsmMsgheader: string }): Promise<DeliveryResult> {
  const usercode = provider?.netgsmUsercode ?? process.env.NETGSM_USERCODE;
  const password = provider?.netgsmPassword ?? process.env.NETGSM_PASSWORD;
  const msgheader = provider?.netgsmMsgheader ?? process.env.NETGSM_MSGHEADER;
  if (!usercode || !password || !msgheader) return { sent: false, skipped: true, provider: "netgsm", error: "Netgsm yapılandırılmadı." };
  try {
    const response = await fetch("https://api.netgsm.com.tr/sms/rest/v2/send", {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${usercode}:${password}`).toString("base64")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        msgheader,
        messages: [{ msg: message.slice(0, 155), no: phoneE164.replace(/^\+90/, "") }],
        encoding: "UTF-8",
        iysfilter: "0",
        appname: "lovask",
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const body = await response.json().catch(() => ({})) as { code?: string; jobid?: string; description?: string };
    if (!response.ok || body.code !== "00") return { sent: false, skipped: false, provider: "netgsm", error: body.description || body.code || `HTTP ${response.status}` };
    return { sent: true, skipped: false, provider: "netgsm", messageId: body.jobid };
  } catch (error) {
    return { sent: false, skipped: false, provider: "netgsm", error: error instanceof Error ? error.message : "Netgsm bağlantı hatası." };
  }
}

export function deliveryUpdate(results: DeliveryResult[], phase: "receipt" | "decision" | "invitation") {
  const now = new Date().toISOString();
  const email = results.find((result) => result.provider === "resend");
  const sms = results.find((result) => result.provider === "netgsm");
  const errors = results.filter((result) => !result.sent).map((result) => `${result.provider}: ${result.error}`).join(" | ");
  return {
    ...(phase === "receipt" && email?.sent ? { receipt_email_sent_at: now } : {}),
    ...(phase === "receipt" && sms?.sent ? { receipt_sms_sent_at: now } : {}),
    ...(phase === "decision" && email?.sent ? { decision_email_sent_at: now } : {}),
    ...(phase === "decision" && sms?.sent ? { decision_sms_sent_at: now } : {}),
    ...(phase === "invitation" && sms?.sent ? { invitation_sms_sent_at: now } : {}),
    notification_last_error: errors ? errors.slice(0, 1000) : null,
  };
}

function emailLayout(title: string, message: string, code: string) {
  return `<!doctype html><html lang="tr"><body style="margin:0;background:#0b090c;color:#eee7df;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:40px 16px"><table role="presentation" width="100%" style="max-width:560px;background:#151116;border:1px solid #3b3028;border-radius:18px"><tr><td style="padding:36px"><p style="margin:0 0 24px;color:#d6ad70;letter-spacing:3px;font-size:12px">LOVASK</p><h1 style="margin:0 0 16px;font-size:28px">${escapeHtml(title)}</h1><p style="margin:0 0 24px;color:#b8adb1;line-height:1.7">${message}</p><p style="margin:0;padding:14px;background:#0b090c;border-radius:10px;color:#e3c18c;letter-spacing:2px;text-align:center">${escapeHtml(code)}</p></td></tr></table></td></tr></table></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

function asciiSms(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/İ/g, "I").replace(/ş/g, "s").replace(/Ş/g, "S").replace(/ğ/g, "g").replace(/Ğ/g, "G").replace(/ç/g, "c").replace(/Ç/g, "C").replace(/ö/g, "o").replace(/Ö/g, "O").replace(/ü/g, "u").replace(/Ü/g, "U");
}
