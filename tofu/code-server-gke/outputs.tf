output "release_name" {
  value = helm_release.codeserver.name
}

output "namespace" {
  value = helm_release.codeserver.namespace
}
