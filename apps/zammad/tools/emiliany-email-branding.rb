require 'base64'
require 'net/http'
require 'uri'
# Zammad deliberately strips remote images. Fetch the centrally configured
# public logo during provisioning; its native inline-image pipeline turns the
# same PNG into a CID attachment without weakening sanitization globally.
def emiliany_email_branding(html)
  source = html.match(/<img[^>]+src="([^"]+)"/)&.captures&.first
  uri = URI.parse(source.to_s)
  raise 'Expected the public Emiliany HTTPS logo' unless uri.scheme == 'https' && uri.host == 'emiliany.com' && uri.path == '/brand/emiliany-logo.png' && !uri.userinfo
  response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 10, read_timeout: 15) { |http| http.get(uri.request_uri) }
  raise 'Unable to load public logo' unless response.is_a?(Net::HTTPSuccess) && response.body.bytesize.between?(8, 2_000_000) && response.body.b.start_with?("\x89PNG\r\n\x1a\n".b)
  html.sub(source, "data:image/png;base64,#{Base64.strict_encode64(response.body)}")
end
