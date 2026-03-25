git fetch upstream
git merge upstream/main --squash
git commit -m "同步上游 v版本号"
git push origin main