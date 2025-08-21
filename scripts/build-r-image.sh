# (Optional) enable BuildKit for speed
export DOCKER_BUILDKIT=1

R_VERSION=4.4.1
PROJECT_NAME="maive"
IMAGE_NAME="rlib"

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

if [[ -z "$AWS_ACCOUNT_ID" || -z "$AWS_REGION" ]]; then
    error "AWS account ID or region not found. Please run 'aws configure' to set your AWS credentials."
    exit 1
fi

REPOSITORY_NAME="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
IMAGE_TAG="al2023-r${R_VERSION}-maive"

# Build locally
docker build -f lambda-r-backend/Dockerfile.rlib -t $PROJECT_NAME-$IMAGE_NAME:$IMAGE_TAG .

aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $REPOSITORY_NAME

docker tag $PROJECT_NAME-$IMAGE_NAME:$IMAGE_TAG $REPOSITORY_NAME/$PROJECT_NAME-$IMAGE_NAME:$IMAGE_TAG
docker push $REPOSITORY_NAME/$PROJECT_NAME-$IMAGE_NAME:$IMAGE_TAG
