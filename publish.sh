#!/bin/bash

PKG_NAME="@ymchun/ngx-markdown-editor"
LATEST_VER=`npm show $PKG_NAME version`
ROOT_PATH=$(pwd)

function check {
  # check signal file
  if [ "$?" -gt 0 ]; then
    echo -e "\033[0;31mDeploy failed\033[0m"
    exit 1
  fi
}

# ask for new version number
echo "=============================="
echo "Current version: $LATEST_VER"
echo "=============================="
echo "You are going publish new version of $PKG_NAME"
echo "What is the new version number?"

# read user input
read NEW_VERSION

# confirm proceed
echo "Publishing $NEW_VERSION, are you sure to proceed? (y/N)"

# read user input
read CONTINUE

# check proceed
if [[ $CONTINUE = "y" || $CONTINUE = "Y" ]]; then
  echo "Publishing verion $NEW_VERSION ..."

  # clean previous distribution
  rm -rf dist
  # detect node_modules
  if [ ! -d ./node_modules ]; then
    npm install
  fi
  # build new distribution
  npm run build; check

  # go to library directory
  cd projects/ngx-markdown-editor
  # increase npm version
  npm version --no-git-tag-version $NEW_VERSION; check

  # go to root path
  cd $ROOT_PATH
  # commit new version
  git add .
  git commit -m "Release version $NEW_VERSION"
  # tag new version
  git tag $NEW_VERSION
  # push to remote
  git push
  git push --tags

  echo "Successfully released verion $NEW_VERSION"
else
  echo "Abort"
fi
