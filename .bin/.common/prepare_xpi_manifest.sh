#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

source "${DIR}/prepare_new_manifest.sh"

node "${DIR}/prepare_xpi_manifest.js" "${ext_dir}/manifest.json"
