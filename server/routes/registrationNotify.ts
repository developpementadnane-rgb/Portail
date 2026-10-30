import nodemailer from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";

// Même configuration SMTP que server/routes/email.ts (compte Gmail de
// l'organisation). On garde un transporteur séparé ici pour ne pas coupler
// ce module à email.ts, qui est dédié au flux PIN/contact.
const smtpUser = (process.env.SMTP_USER || "").replace(/[^\x21-\x7E]/g, "");
const smtpPass = (process.env.SMTP_PASS || "").replace(/[^\x21-\x7E]/g, "");

const transporter = nodemailer.createTransport({
  host: (process.env.SMTP_HOST || "smtp.gmail.com").trim(),
  port: Number(process.env.SMTP_PORT || 587),
  secure: (process.env.SMTP_SECURE || "").trim() === "true",
  auth: { user: smtpUser, pass: smtpPass },
});

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface PendingRow {
  id: string;
  generated_id: string;
  first_name: string;
  last_name: string;
  user_phone: string;
  email: string;
  gender: string;
}

/**
 * Prévient tous les chefs par e-mail qu'une nouvelle demande d'inscription
 * attend leur validation. Best-effort : les erreurs sont laissées à
 * l'appelant, qui les avale pour ne jamais faire échouer l'inscription
 * elle-même.
 */
export async function notifyChefsOfNewRegistration(
  adminClient: SupabaseClient,
  pending: PendingRow,
) {
  if (!smtpUser || !smtpPass) {
    console.warn("SMTP non configuré : notification chefs ignorée.");
    return;
  }

  const { data: chefs, error } = await adminClient
    .from("user_chefs")
    .select("email")
    .not("email", "is", null);

  if (error) throw error;

  const recipients = (chefs || [])
    .map((c: { email: string | null }) => c.email)
    .filter((e: string | null): e is string => !!e && e.includes("@"));

  if (recipients.length === 0) return;

  const safeName = escapeHtml(`${pending.first_name} ${pending.last_name}`);
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f4f4f7;padding:20px}.card{max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.08)}h1{color:#2c3e50;font-size:20px}p{color:#444;line-height:1.5}.id{display:inline-block;margin:8px 0;padding:6px 14px;font-weight:bold;background:#eef2f7;border-radius:4px}
</style></head><body><div class="card">
<h1>Nouvelle demande d'inscription</h1>
<p><strong>${safeName}</strong> a demandé à rejoindre le groupe.</p>
<p>Identifiant généré : <span class="id">${escapeHtml(pending.generated_id)}</span></p>
<p>Connectez-vous au portail Chefs, section « Demandes en attente », pour consulter le dossier complet et l'accepter ou le refuser.</p>
</div></body></html>`;

  await transporter.sendMail({
    from: `"SHM — Portail Membres" <${smtpUser}>`,
    to: recipients.join(","),
    subject: `Nouvelle demande d'inscription — ${pending.first_name} ${pending.last_name}`,
    html,
  });
}

/**
 * Envoie au membre nouvellement authentifié ses informations et ses trois
 * documents (fiche d'adhésion PDF, QR code, badge) en pièces jointes.
 */
export async function sendWelcomeEmail(params: {
  to: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  generatedId: string;
  attachments: { filename: string; content: Buffer; contentType: string }[];
}) {
  if (!smtpUser || !smtpPass) {
    console.warn("SMTP non configuré : e-mail de bienvenue ignoré.");
    return;
  }

  const safeFirst = escapeHtml(params.firstName);
  const safeLast = escapeHtml(params.lastName);
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f4f4f7;padding:20px}.card{max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.08)}h1{color:#2c3e50;font-size:20px}p{color:#444;line-height:1.5}.id{display:inline-block;margin:8px 0;padding:6px 14px;font-weight:bold;color:#fff;background:#2c3e50;border-radius:4px}
</style></head><body><div class="card">
<h1>Votre compte a été authentifié ✅</h1>
<p>Bonjour ${safeFirst} ${safeLast},</p>
<p>Votre inscription a été validée par un chef. Vous pouvez maintenant vous connecter.</p>
<p>Identifiant : <span class="id">${escapeHtml(params.generatedId)}</span></p>
<p>Date de naissance : ${escapeHtml(params.birthDate)}</p>
<p>Vous trouverez en pièces jointes votre fiche d'adhésion, votre QR code et votre badge.</p>
</div></body></html>`;

  await transporter.sendMail({
    from: `"SHM — Portail Membres" <${smtpUser}>`,
    to: params.to,
    subject: "Votre compte a été authentifié",
    html,
    attachments: params.attachments,
  });
}
