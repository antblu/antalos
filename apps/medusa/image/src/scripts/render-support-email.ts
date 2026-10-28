// Generate the Zammad-owned acknowledgement from the shared email layout.
// Run with ts-node; redirect stdout to the checked-in Zammad HTML artifact.
import { render, type Order } from "../lib/lifecycle/templates"
const order = { customer: { first_name: "#{ticket.customer.firstname}" } } as Order
console.log(render("contact", { order, ticket: "#{ticket.number}" }).html)
