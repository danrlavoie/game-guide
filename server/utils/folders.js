function getChildFolders(db, folder) {
  var allDocs = db
    .prepare(
      '\
    SELECT parent_folder FROM documents WHERE parent_folder LIKE ? \
    GROUP BY parent_folder\
  '
    )
    .all(folder + '%');

  var folderSet = {};
  var prefix = folder ? folder + '/' : '';
  allDocs.forEach(function (row) {
    var relative = row.parent_folder;
    if (relative === folder) return;
    var afterPrefix = folder ? relative.substring(prefix.length) : relative;
    if (!afterPrefix) return;
    var firstPart = afterPrefix.split('/')[0];
    if (firstPart) {
      folderSet[firstPart] = true;
    }
  });

  return Object.keys(folderSet)
    .sort()
    .map(function (name) {
      return { name: name, path: prefix + name };
    });
}

module.exports = { getChildFolders: getChildFolders };
