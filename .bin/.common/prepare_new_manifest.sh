#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

source "${DIR}/validate_env.sh"

# ------------------------------------------------------------------------------
# bootstrap

function main {
  [ -f "${ext_dir}/manifest.json" ] && rm "${ext_dir}/manifest.json"

  cp "${ext_dir}/manifest.json.tpl" "${ext_dir}/manifest.json"
}

main
