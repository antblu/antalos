---
title: RAG knowledge base for antblu.net Services
description: Import the Services assistant corpus into Open WebUI and connect the site chat to LiteLLM.
---

This package gives the public Services assistant answers about Anthony Bluemel’s infrastructure, SaaS replacement, web development, and e-commerce services. It covers package scope and pricing, application selection, operating costs, client ownership, handoff, and the project brief.

- `knowledge.jsonl` is the corpus. Each line is one UTF-8 JSON record with a stable `id`, `title`, example `questions`, answer `text`, and `source_urls`.
- `system-prompt.txt` sets the public assistant’s role and rules for quotes, scope, and follow-up.

Use the published Services pages and site terms for package scope, pricing, and engagement terms. Use the Antalos handbook for reference architecture. Each record includes public URLs the assistant can cite.

## Use Open WebUI for the website chat

The Services chat queries the private Antblu Services knowledge base through Open WebUI’s collection API. It sends the retrieved passages to the Gemma model through LiteLLM and streams answer text to the browser. Source links arrive when the answer finishes. Visitors can use the project brief if chat is unavailable.

Run the importer from this directory with an Open WebUI account that can create and write knowledge bases:

```sh
python3 import-open-webui.py --email YOUR_OPEN_WEBUI_EMAIL
```

The importer prompts for a password, or you can set `OPEN_WEBUI_API_KEY` for an account with API keys enabled. It exports upload-ready text files with `--export DIRECTORY`. The corpus uses one file per record. Keep the knowledge base private and give the website's dedicated Open WebUI account read access to that collection. The endpoint signs in as that account and renews its session as needed.

### Prepare the release

1. Create a Cloudflare Turnstile widget restricted to the website hostname configured in `ANTBLU_HOST`. The chat uses the action `services_chat`. [Cloudflare widget setup](https://developers.cloudflare.com/turnstile/get-started/)
2. Seal a Secret named `antblu-services-chat-runtime` in namespace `antblu` with keys `turnstile-site-key`, `turnstile-secret-key`, and `redis-password`. Use the widget keys from Cloudflare and a Redis password generated with `openssl rand -hex 32`. Use the `sealed-secrets-controller` in namespace `sealed-secrets` and save the SealedSecret under `apps/antblu/`.
3. Publish the Antalos manifests and the portfolio image in the same release window. The old browser sends a `questions` array. The new browser reads chat configuration before it can obtain a session. Chat can be unavailable between rollouts.
4. Open the public Services page in a fresh browser and submit a pricing question. Confirm that text appears incrementally and that source links appear at the end. Ask a follow-up in the same session, confirm that requests without a verified session are rejected, and check the project brief fallback.

After editing the system prompt, update the copy in `apps/antblu/services-chat-config.yaml` and refresh the `services-chat-config-checksum` annotation in `apps/antblu/services-chat.yaml` so Argo CD rolls the API pods.

### Session limits and availability

Both API replicas share one password-protected Redis instance. Each visitor starts a one-hour session after the server verifies the Turnstile token, hostname, and action. Redis stores up to three earlier successful questions for follow-up context. A Secure, HttpOnly cookie carries the session ID. Limits apply per verified browser session because the public TCP proxy path does not preserve the visitor IP. Each session allows one in-flight request and 10 answer attempts per 10 minutes. Both replicas share limits of 60 answer attempts and 120 verification attempts per minute.

Redis stores sessions and counters in memory. Restarting or replacing the Redis pod resets both and requires browsers to verify again. Redis is a single point of failure for this chat. The project brief remains available during a chat outage.

## Use the existing llama.cpp models directly

Use the three baseline model IDs from the checked-in llama-swap configuration when calling that router directly. If you use a gateway, use its configured model IDs.

| Role | Configured llama-swap model ID | Route |
| --- | --- | --- |
| Embedding | `Qwen/Qwen3-Embedding-0.6B:Q8_0` | `POST /v1/embeddings` |
| Reranking | `Qwen/Qwen3-Reranker-0.6B:Q8_0` | `POST /v1/rerank` |
| Chat | `unsloth/gemma-4-E4B-it-GGUF:UD-Q4_K_XL` | `POST /v1/chat/completions` |

Routes above are relative to the server origin. A client configured with a base URL ending in `/v1` should append only the remaining route. Use the model IDs your endpoint exposes. [llama.cpp server API](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) · [llama-swap routes](https://github.com/mostlygeek/llama-swap)

1. **Index.** Parse one record per line and embed its title, example questions, and answer as one text block. Send these through the embeddings route as `input` with the embedding `model`. Store the vector with the complete record and keep source URLs as metadata. Rebuild the vectors if the embedding model or input format changes.
2. **Retrieve.** Embed the visitor’s question using the same model and apply any query formatting that model requires. For a short follow-up like “What about HA?”, include enough conversation context to make the query stand on its own. Start by passing up to four relevant vector matches and their source URLs to chat.
3. **Rerank (optional).** Send the retrieved candidates to the reranker with the visitor's query. Use the returned indices to select the original records and their source URLs.
4. **Answer.** Send the supplied system prompt, the visitor question, and the retrieved evidence with its source URLs to the chat model. Keep the evidence in a delimited data block outside the system instructions. When retrieval returns no relevant evidence, let the assistant direct the visitor to the project brief for confirmation.

The Services browser can call a site backend that holds the inference credentials, runs retrieval, and returns the answer. Keep that backend restricted to this corpus and keep client runbooks, credentials, and infrastructure configuration outside the public index.

## Maintain the corpus

Update the relevant records when the public site changes its prices, package scope, catalog, handoff, or contact flow. Reindex new and changed record IDs and remove retired IDs from the index.

| Example visitor question | Expected answer behavior |
| --- | --- |
| How much is one server? | Give the Standard planning range of $3,000 to $6,000 USD and explain that hosting and project-specific scope affect total cost. |
| How much is a landing page or a multi-page business site? | Give the $900 Landing Page and $2,500 Business Website starting prices in USD. Explain the page scope and link to Web Development. |
| What will I pay to build an online store? | Give the $5,000 Standard and $10,000 Custom starting prices in USD. Note that advanced projects can exceed $25,000 and explain the separate operating costs. |
| What does it cost to run a VPS each month? | Give the illustrative $30 to $300 USD monthly compute allowance and explain the additional workload costs. |
| Can I compare my SaaS costs with self-hosting? | Link to the calculator and explain how to use the company’s own bills over one, three, or five years. |
| Can I host this in my account and keep the code? | Confirm client control of the account and project code. Link to the handoff page. |
| Will HA guarantee zero downtime? | Explain the relevant failure domains and ask which workflow must stay available. Leave commitments to the project agreement. |
| Can you migrate our files and finish next week? | Explain what needs scoping for migration and send the requested date to Anthony via the project brief. |
| What happens if something breaks after handoff? | Explain the designated operator, recovery instructions, and training. Direct questions about on-call or ongoing support to Anthony. |
| I’m ready. Can you book me in? | Link to the project brief and explain that the visitor sends it from their email app. |
