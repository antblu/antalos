import type { CreateProductWorkflowInputDTO, UpdateProductWorkflowInputDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createProductsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { ODOO_MODULE } from "../modules/odoo"
import type OdooModuleService from "../modules/odoo/service"

type Input = { after_id: number; limit: number }

const prepareOdooProducts = createStep("prepare-odoo-products", async (input: Input, { container }) => {
  const odoo = container.resolve<OdooModuleService>(ODOO_MODULE)
  const products = await odoo.listProducts(input.after_id, input.limit)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const creates: CreateProductWorkflowInputDTO[] = []
  const updates: UpdateProductWorkflowInputDTO[] = []
  if (!products.length) return new StepResponse({ creates, updates, count: 0, after_id: input.after_id })

  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["id", "external_id", "status", "metadata", "variants.id", "variants.metadata", "options.id", "options.title", "options.values.value"],
    filters: { external_id: products.map((p) => `odoo:product.template:${p.id}`) },
    pagination: { take: input.limit * 2 },
  })
  const { data: stores } = await query.graph({ entity: "store", fields: ["default_sales_channel_id"] })
  const { data: profiles } = await query.graph({
    entity: "shipping_profile", fields: ["id"], filters: { type: "default" },
  })

  for (const product of products) {
    const externalId = `odoo:product.template:${product.id}`
    const matches = existing.filter((p) => p.external_id === externalId)
    if (matches.length > 1) throw new Error(`Duplicate Medusa external_id ${externalId}`)
    const current = matches[0]
    if (!product.variants.length) throw new Error(`Odoo product ${product.id} has no active variants`)
    const optionValues = new Map<string, Set<string>>()
    for (const variant of product.variants) {
      for (const [title, value] of Object.entries(variant.options)) {
        if (!optionValues.has(title)) optionValues.set(title, new Set())
        optionValues.get(title)!.add(value)
      }
    }
    // Removing variants could discard inventory/pricing relationships. Require
    // an explicit catalog reconciliation rather than silently deleting them.
    if (current?.variants?.some((v) => !product.variants.some((ov) => String(ov.id) === v.metadata?.odoo_variant_id))) {
      throw new Error(`Odoo product ${product.id} removed a variant; reconcile it manually in Medusa`)
    }
    if (current && (current.options?.length !== optionValues.size || current.options.some((o) =>
      !optionValues.has(o.title) || [...optionValues.get(o.title)!].some((value) =>
        !o.values?.some((v) => v.value === value))))) {
      throw new Error(`Odoo product ${product.id} changed option definitions; reconcile them manually in Medusa`)
    }
    const variants = product.variants.map((variant) => {
      if (!Number.isFinite(variant.lst_price) || variant.lst_price < 0) {
        throw new Error(`Invalid price on Odoo variant ${variant.id}`)
      }
      if (Object.keys(variant.options).length !== optionValues.size) {
        throw new Error(`Odoo variant ${variant.id} has an incomplete option combination`)
      }
      const match = current?.variants?.find((v) => v.metadata?.odoo_variant_id === String(variant.id))
      return {
        ...(match ? { id: match.id } : { manage_inventory: true, allow_backorder: false }),
        title: variant.name,
        sku: variant.default_code || `odoo-variant-${variant.id}`,
        options: variant.options,
        // Medusa v2 uses major currency units. lst_price includes variant extras.
        prices: [{ currency_code: product.currency, amount: variant.lst_price }],
        metadata: { ...match?.metadata, odoo_variant_id: String(variant.id) },
      }
    })
    const common = {
      external_id: externalId,
      title: product.name,
      description: product.description_sale || "",
      status: !product.active || !product.sale_ok ? ProductStatus.DRAFT
        : typeof product.is_published === "boolean"
          ? (product.is_published ? ProductStatus.PUBLISHED : ProductStatus.DRAFT)
          : current?.status || ProductStatus.DRAFT,
      metadata: { ...current?.metadata, odoo_template_id: String(product.id) },
      variants,
    }
    if (current) {
      updates.push({ ...common, id: current.id })
    } else {
      const channel = stores[0]?.default_sales_channel_id
      const profile = profiles[0]?.id
      if (!channel || !profile) throw new Error("Odoo imports need a default sales channel and default shipping profile")
      creates.push({
        ...common,
        options: [...optionValues].map(([title, values]) => ({ title, values: [...values] })),
        handle: `odoo-${product.id}-${product.name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product"}`,
        sales_channels: [{ id: channel }], shipping_profile_id: profile,
      })
    }
  }
  return new StepResponse({ creates, updates, count: products.length, after_id: products[products.length - 1].id })
})

export const syncFromOdooWorkflow = createWorkflow("sync-from-odoo", (input: Input) => {
  const prepared = prepareOdooProducts(input)
  createProductsWorkflow.runAsStep({ input: { products: prepared.creates } })
  updateProductsWorkflow.runAsStep({ input: { products: prepared.updates } })
  return new WorkflowResponse({ count: prepared.count, after_id: prepared.after_id })
})
