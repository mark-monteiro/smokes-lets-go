#!/bin/bash
set -e

SOURCE_ROOT="$PWD"
TEMP_DIR_NAME="$1"
TEMP_DIR="$SOURCE_ROOT/$TEMP_DIR_NAME"
SOURCE_ARCHIVE="$SOURCE_ROOT/$2"

#remove existing temp files and zip file
rm -f "$SOURCE_ARCHIVE"
rm -fr "$TEMP_DIR"

#build up list of files to exclude from package
#TODO: include files from gitignore
ignoredFiles=("buildTemp/" '.git/' '.gitignore' 'README.md' 'source.zip' 'package-app.sh')
excludeArgs=''
for file in "${ignoredFiles[@]}"; do
	excludeArgs="$excludeArgs --exclude=/$file"
done

#copy files to temporary directory
echo "Copying files to temp directory..."
eval "rsync -a $excludeArgs --exclude=/www $SOURCE_ROOT/* $TEMP_DIR"
eval "rsync -a $excludeArgs $SOURCE_ROOT/www/* $TEMP_DIR"

#create archive
echo "creating archive..."
pushd "$TEMP_DIR"
zip -r $SOURCE_ARCHIVE *
popd

#remove temporary directory
echo "removing temporary files"
rm -r --interactive=never $TEMP_DIR