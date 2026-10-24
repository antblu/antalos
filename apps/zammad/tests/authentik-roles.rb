# Run after loading the source initializer in a Rails runner process.
Authorization::Provider::OpenidConnect.prepend(AntalosAuthentikRoles)
ActiveRecord::Base.transaction do
  UserInfo.current_user_id = 1
  user = User.create!(login: "antalos-roles-check-#{SecureRandom.hex(8)}", firstname: 'Role', lastname: 'Check', email: "#{SecureRandom.hex(8)}@example.invalid", active: true, roles: [Role.find_by!(name: 'Customer')])
  def identity(groups)
    { 'uid' => 'transaction-check', 'info' => {}, 'extra' => { 'raw_info' => { 'groups' => groups } } }
  end
  Authorization::Provider::OpenidConnect.new(identity(%w[zammad-users zammad-admins]), user)
  raise 'admin grant failed' unless user.roles.pluck(:name).sort == %w[Admin Agent].sort
  Authorization::Provider::OpenidConnect.new(identity(%w[zammad-users]), user)
  raise 'admin removal failed' unless user.roles.pluck(:name) == ['Customer']
  symbol_identity = { 'uid' => 'transaction-check', 'info' => {}, 'extra' => { 'raw_info' => { groups: %w[zammad-users zammad-admins] } } }
  Authorization::Provider::OpenidConnect.new(symbol_identity, user)
  raise 'symbol-key claims failed' unless user.roles.pluck(:name).include?('Admin')
  begin
    Authorization::Provider::OpenidConnect.new(identity([]), user)
    raise 'outsider accepted'
  rescue Authorization::Provider::AccountError
  end
  puts 'ZAMMAD_ROLE_CHECK admin grant, removal and outsider denial passed; rolling back'
  raise ActiveRecord::Rollback
end
