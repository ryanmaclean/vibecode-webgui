# Verify files to ensure they're valid TypeScript after modifications
function verify_typescript_files {
  echo "Verifying TypeScript files..."
  
  if [ "$DRY_RUN" = true ]; then
    echo "Would verify TypeScript files"
    return 0
  fi
  
  # Check if tsc is available
  if ! command -v npx &> /dev/null; then
    echo "Warning: npx not found, skipping TypeScript verification"
    return 0
  fi
  
  # Create temporary tsconfig for verification
  temp_tsconfig=$(mktemp)
  cat > "$temp_tsconfig" << EOF
{
  "compilerOptions": {
    "target": "es2016",
    "module": "commonjs",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": [
    "${BASE_DIR}/*.ts"
  ]
}
EOF
  
  # Run TypeScript compiler in noEmit mode to verify syntax
  if ! npx tsc --noEmit --project "$temp_tsconfig"; then
    echo "TypeScript verification failed!"
    rm "$temp_tsconfig"
    return 1
  fi
  
  # Clean up
  rm "$temp_tsconfig"
  echo "TypeScript verification passed"
  return 0
}