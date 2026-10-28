require_relative 'emiliany-email-branding'
# Apply only the generated acknowledgement; no credentials or group changes.
# rails runner this-script.rb < emiliany-acknowledgement.html
UserInfo.current_user_id = 1
html = STDIN.read
raise 'Missing branded template' unless html.include?('alt="Emiliany"') && html.include?('#{ticket.number}') && html.include?('support@emiliany.com')
trigger = Trigger.find_by!(name: 'EMILIANY website contact acknowledgement')
perform = trigger.perform.deep_dup
perform.fetch('notification.email')['body'] = emiliany_email_branding(html)
trigger.update!(perform: perform)
puts 'Acknowledgement template updated'
