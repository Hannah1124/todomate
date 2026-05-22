export default async function handler(req, res) {
  return res.status(200).json({
    message: "Adyen sessions API is ready. Payment connection pending."
  });
}
