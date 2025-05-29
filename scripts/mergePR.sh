#!/bin/bash

MASTER_BRANCH="master"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

gh pr merge --auto --rebase --delete-branch

git checkout $MASTER_BRANCH
git pull --rebase origin $MASTER_BRANCH
git branch -D $CURRENT_BRANCH

echo "PR merged and branch deleted"
