#!/usr/bin/env bash
set -euo pipefail

AWS_ACCOUNT_ID="${1:?AWS_ACCOUNT_ID missing}"
AWS_REGION="${2:?AWS_REGION missing}"
R_VERSION="${3:?R_VERSION missing}"
GITHUB_PAT="${4:?GITHUB_PAT missing}"
GITHUB_USERNAME="${5:?GITHUB_USERNAME missing}"

ECR_REPO="rlib"
REPOSITORY_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
RLIB_TAG="al2023-r${R_VERSION}-maive"

echo "-> Ensuring ECR login"
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin \
    "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "-> Ensuring repository ${ECR_REPO} exists"
aws ecr describe-repositories --repository-names "${ECR_REPO}" --region "${AWS_REGION}" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "${ECR_REPO}" --region "${AWS_REGION}" >/dev/null

echo "-> Checking if image exists: ${REPOSITORY_URI}:${RLIB_TAG}"
if aws ecr describe-images \
    --repository-name "${ECR_REPO}" \
    --region "${AWS_REGION}" \
    --image-ids imageTag="${RLIB_TAG}" >/dev/null 2>&1; then
  echo "Image already exists. Skipping build."
  exit 0
fi

echo "-> Building & pushing rlib:${RLIB_TAG}"
# Build from your dedicated rlib Dockerfile
docker build \
  -f lambda-r-backend/Dockerfile.rlib \
  -t "rlib-build:${RLIB_TAG}" \
  --build-arg GITHUB_PAT="${GITHUB_PAT}" \
  --build-arg GITHUB_USERNAME="${GITHUB_USERNAME}" \
  .

docker tag "rlib-build:${RLIB_TAG}" "${REPOSITORY_URI}:${RLIB_TAG}"
docker push "${REPOSITORY_URI}:${RLIB_TAG}"

echo "Done."
