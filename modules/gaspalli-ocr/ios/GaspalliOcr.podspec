Pod::Spec.new do |s|
  s.name           = 'GaspalliOcr'
  s.version        = '1.0.0'
  s.summary        = 'OCR (Vision) avec la position de chaque ligne, pour les tickets de caisse'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'Gaspalli'
  s.homepage       = 'https://github.com/SAD3S/Gaspali'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
