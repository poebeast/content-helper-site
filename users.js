// Team of content-helper. id is used in URLs (#/u/<id>) and in offer files: <!-- content-helper: owner=<id> -->
// No login: the static site cannot check who is who, so picking a user is a convenience, not access control.
export const USERS = [
  { id: "zhenya", name: "Женя", color: "#857bff" },
  { id: "emin", name: "Эмин", color: "#5fd39a" },
  { id: "sergey", name: "Сергей", color: "#ffb648" },
  { id: "vlad", name: "Влад", color: "#87caff" },
  { id: "kolya", name: "Коля", color: "#ff7a9c" },
];
export const userById = (id) => USERS.find((u) => u.id === id) || null;
