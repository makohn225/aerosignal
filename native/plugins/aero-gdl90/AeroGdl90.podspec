Pod::Spec.new do |s|
  s.name = 'AeroGdl90'
  s.version = '0.1.0'
  s.summary = 'AeroSignal GDL 90 UDP receiver'
  s.license = 'UNLICENSED'
  s.homepage = 'https://aerosignal-app.vercel.app'
  s.author = 'AeroSignal'
  s.source = { :git => '', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/**/*.swift'
  s.ios.deployment_target = '14.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
