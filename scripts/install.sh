#!/usr/bin/env bash
set -euo pipefail

slur_repo="${SLUR_GITHUB_REPO:-darhebkf/slur}"
slur_version="${SLUR_VERSION:-latest}"
temporary_root=""
targets=("$@")

cleanup() {
  if [[ -n "$temporary_root" && -d "$temporary_root" ]]; then
    rm -rf -- "$temporary_root"
  fi
}
trap cleanup EXIT

path_contains() {
  case ":${PATH}:" in
    *":$1:"*) return 0 ;;
    *) return 1 ;;
  esac
}

if [[ -n "${SLUR_INSTALL_ROOT:-}" ]]; then
  install_root="$SLUR_INSTALL_ROOT"
elif path_contains "${HOME:?}/.local/bin"; then
  install_root="${HOME}/.local"
elif path_contains "${HOME}/.cargo/bin"; then
  install_root="${HOME}/.cargo"
else
  install_root="${HOME}/.local"
fi

project_root=""
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  script_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
  project_root="$(CDPATH= cd -- "${script_dir}/.." 2>/dev/null && pwd || true)"
fi
binary_path="${install_root}/bin/slur"

platform_asset() {
  local system architecture
  system="$(uname -s)"
  architecture="$(uname -m)"

  case "$system" in
    Darwin) system=macos ;;
    Linux) system=linux ;;
    *) return 1 ;;
  esac

  case "$architecture" in
    x86_64|amd64) architecture=x64 ;;
    arm64|aarch64) architecture=arm64 ;;
    *) return 1 ;;
  esac

  printf 'slur-%s-%s.tar.gz\n' "$system" "$architecture"
}

verify_checksum() {
  local archive="$1"
  local checksum_file="$2"
  local expected actual
  expected="$(awk 'NR == 1 { print $1 }' "$checksum_file")"

  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$archive" | awk '{ print $1 }')"
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$archive" | awk '{ print $1 }')"
  else
    printf '%s\n' 'slur: sha256sum or shasum is required to verify the download' >&2
    exit 1
  fi

  if [[ -z "$expected" || "$expected" != "$actual" ]]; then
    printf '%s\n' 'slur: release checksum verification failed' >&2
    exit 1
  fi
}

install_from_release() {
  command -v curl >/dev/null 2>&1 || {
    printf '%s\n' 'slur: curl is required' >&2
    exit 1
  }
  command -v tar >/dev/null 2>&1 || {
    printf '%s\n' 'slur: tar is required' >&2
    exit 1
  }

  local asset archive checksum release_url
  asset="$(platform_asset)" || {
    printf '%s\n' "slur: unsupported platform $(uname -s)/$(uname -m)" >&2
    exit 1
  }
  temporary_root="$(mktemp -d "${TMPDIR:-/tmp}/slur.XXXXXX")"
  archive="${temporary_root}/${asset}"
  checksum="${archive}.sha256"
  if [[ "$slur_version" == latest ]]; then
    release_url="https://github.com/${slur_repo}/releases/latest/download"
  else
    release_url="https://github.com/${slur_repo}/releases/download/${slur_version}"
  fi

  curl --proto '=https' --tlsv1.2 --retry 3 -fsSL "${release_url}/${asset}" -o "$archive"
  curl --proto '=https' --tlsv1.2 --retry 3 -fsSL "${release_url}/${asset}.sha256" -o "$checksum"
  verify_checksum "$archive" "$checksum"
  tar -xzf "$archive" -C "$temporary_root"
  mkdir -p "${install_root}/bin"
  install -m 755 "${temporary_root}/slur" "$binary_path"
}

if [[ -n "$project_root" && -f "$project_root/Cargo.toml" && -f "$project_root/src/main.rs" ]]; then
  command -v cargo >/dev/null 2>&1 || {
    printf '%s\n' 'slur: cargo is required when installing from a checkout' >&2
    exit 1
  }
  cargo install --path "$project_root" --root "$install_root" --force
else
  install_from_release
fi

if ((${#targets[@]} == 1)) && [[ "${targets[0]}" == all ]]; then
  "$binary_path" setup --all
elif ((${#targets[@]} > 0)); then
  "$binary_path" setup "${targets[@]}"
elif [[ -t 0 && -t 2 ]]; then
  "$binary_path" setup
else
  "$binary_path" setup --yes
fi

if ! path_contains "${install_root}/bin"; then
  printf '%s\n' "Add ${install_root}/bin to PATH before using /slur." >&2
fi
