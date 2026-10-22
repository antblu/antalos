import { MedusaError } from "@medusajs/framework/utils"

// Existing local administrators and accepted invitations can authenticate, but
// a public emailpass registration must not provision or claim an administrator.
// antID provisioning remains handled by its verified OIDC callback.
export async function POST() {
  throw new MedusaError(
    MedusaError.Types.NOT_ALLOWED,
    "Local administrator accounts require an invitation or operator provisioning",
  )
}
