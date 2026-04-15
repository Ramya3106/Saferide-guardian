const USE_PROTOTYPE_DATA =
  String(process.env.USE_PROTOTYPE_DATA || "true").trim().toLowerCase() !== "false";

module.exports = {
  USE_PROTOTYPE_DATA,
};
