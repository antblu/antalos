import { escapeHtml, httpsUrl, layout } from "../lifecycle/templates"
export type AccountWelcome = { email: string; locale: string; first_name?: string }
export function renderAccountWelcome(data: AccountWelcome) {
  const es = data.locale === "es"
  const subject = es ? "Te damos la bienvenida a Emiliany™" : "Welcome to Emiliany™"
  const title = es ? "Tu historia con Emiliany™ empieza aquí." : "Your Emiliany™ story starts here."
  const greeting = data.first_name ? `${es ? "Hola" : "Hello"}, ${data.first_name}.` : es ? "Nos alegra que estés aquí." : "We’re glad you’re here."
  const copy = es ? "Tu cuenta ya está lista. Puedes guardar tus favoritos, consultar tus pedidos y mantener tus datos en un solo lugar." : "Your account is ready. Save your favorites, keep track of your orders, and manage your details in one place."
  const notice = es ? "Este mensaje confirma la creación de tu cuenta. Tu preferencia de boletín se gestiona por separado en tu cuenta." : "This email confirms your new account. You can manage your separate newsletter preference in your account."
  const action = es ? "Visita tu cuenta" : "Visit your account"
  const store = httpsUrl(process.env.CUSTOMER_STOREFRONT_URL)
  if (!store) throw new Error("Secure storefront URL is required")
  const href = new URL(`/${es ? "es" : "en"}/account`, store).href
  const text = `${greeting}\n\n${copy}\n\n${action}: ${href}\n\n${notice}`
  return { subject, ...layout(subject, `<p style="font:normal 32px/1.2 Georgia,serif;">${title}</p><p style="line-height:1.8;">${escapeHtml(greeting)}</p><p style="line-height:1.8;">${copy}</p><p style="margin:28px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:16px 28px;background:#48591C;color:#F9F9F8;text-decoration:none;">${action} &rarr;</a></p><p style="padding:20px;background:#EFF0EB;font-size:13px;line-height:1.7;">${notice}</p>`, text) }
}
