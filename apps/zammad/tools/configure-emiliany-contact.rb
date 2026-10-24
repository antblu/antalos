# Run with `rails runner` inside Zammad 7.1 after supplying EMILIANY_CONTACT_CONFIG
# as JSON in the environment (smtp_password required). Never print the configuration.
require 'json'
configuration = JSON.parse(ENV.fetch('EMILIANY_CONTACT_CONFIG'))
UserInfo.current_user_id = 1
ActiveRecord::Base.transaction do
  group = Group.find_or_initialize_by(name: 'EMILIANY - Website Contact')
  group.assign_attributes(active: true, assignment_timeout: 0, updated_by_id: 1, created_by_id: group.created_by_id || 1)
  group.save!
  %w[antblu@antblu.net estefania.cc@emiliany.com].each do |email|
    agent = User.find_by!(email: email)
    raise "Inactive or non-agent account: #{email}" unless agent.active && agent.permissions?('ticket.agent')
    agent.group_ids_access_map = agent.group_ids_access_map.merge(group.id => ['full'])
    preferences = agent.preferences.deep_dup
    matrix = preferences.dig('notification_config', 'matrix') || {}
    create = matrix['create'] ||= {}
    (create['criteria'] ||= {}).merge!('owned_by_nobody' => true, 'no' => false)
    (create['channel'] ||= {}).merge!('email' => true, 'online' => true)
    preferences['notification_config'] ||= {}
    preferences['notification_config']['matrix'] = matrix
    agent.preferences = preferences
    agent.save!
  end
  role = Role.find_or_initialize_by(name: 'EMILIANY Website Integration')
  role.assign_attributes(active: true, updated_by_id: 1, created_by_id: role.created_by_id || 1)
  role.save!
  role.permissions = [Permission.find_by!(name: 'ticket.agent')]
  service = User.find_or_initialize_by(login: 'emiliany-website-contact')
  service.assign_attributes(firstname: 'EMILIANY', lastname: 'Website Contact', email: 'website-contact@emiliany.com', active: true,
                            updated_by_id: 1, created_by_id: service.created_by_id || 1)
  service.save!
  service.roles = [role]
  service.group_ids_access_map = { group.id => ['create', 'read'] }
  service.save!
  channel = Channel.find_or_initialize_by(area: 'Email::Account', group_id: group.id)
  channel.assign_attributes(active: true, options: {
    outbound: { adapter: 'smtp', options: { host: 'mail.antblu.net', port: 465, ssl: true, ssl_verify: true,
      user: configuration.fetch('smtp_user', 'admin@emiliany.com'), password: configuration.fetch('smtp_password'), domain: 'emiliany.com' } },
    inbound: { adapter: 'null', options: {} }
  })
  channel.save!
  address = EmailAddress.find_or_initialize_by(email: 'noreply@emiliany.com')
  address.assign_attributes(name: 'EMILIANY', channel_id: channel.id, active: true, updated_by_id: 1, created_by_id: address.created_by_id || 1)
  address.save!
  group.update!(email_address_id: address.id)
  web = Ticket::Article::Type.find_by!(name: 'web').id
  customer = Ticket::Article::Sender.find_by!(name: 'Customer').id
  trigger = Trigger.find_or_initialize_by(name: 'EMILIANY website contact acknowledgement')
  trigger.assign_attributes(active: true, activator: 'action', execution_condition_mode: 'selective',
    condition: { 'ticket.action' => { operator: 'is', value: 'create' },
      'ticket.group_id' => { operator: 'is', value: group.id },
      'article.type_id' => { operator: 'is', value: web },
      'article.sender_id' => { operator: 'is', value: customer } },
    perform: { 'notification.email' => { recipient: 'ticket_customer',
      subject: 'We received your message — EMILIANY',
      body: '<p>Hello #{ticket.customer.firstname},</p><p>Thank you for contacting EMILIANY. We have received your message and a member of our team will get back to you as soon as possible.</p><p>Your request has been added to our support system so our team can track it through completion.</p><p>Your reference: #{config.ticket_hook}#{ticket.number}. Please keep this reference available. For additional information, please use our website contact page and include this reference.</p><p>— EMILIANY</p>' } },
    updated_by_id: 1, created_by_id: trigger.created_by_id || 1)
  trigger.save!
  # Preserve the general-purpose trigger, excluding this group to prevent two acknowledgements.
  default = Trigger.find_by(name: 'auto reply (on new tickets)')
  if default
    condition = default.condition.deep_dup
    condition['ticket.group_id'] = { 'operator' => 'is not', 'value' => group.id }
    default.update!(condition: condition)
  end
  Setting.set('api_token_access', true)
  token = Token.find_by(action: 'api', user_id: service.id, name: 'EMILIANY website contact') ||
          Token.create!(action: 'api', persistent: true, user_id: service.id, name: 'EMILIANY website contact',
                        preferences: { permission: { 'ticket.agent' => true } })
  # Intended only for capture by a secret provisioning process, never interactive logging.
  puts "EMILIANY_CONTACT_TOKEN:#{token.token}" if configuration['export_token']
  puts "EMILIANY_CONTACT_CONFIGURED:#{group.id}"
end
