import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  res.json({ message: "GET all users from user router" });
});

router.get("/:id", (req: Request, res: Response) => {
  const userId = req.params.id;
  res.json({ message: `GET user ${userId} from user router` });
});

router.post("/", (req: Request, res: Response) => {
  res
    .status(201)
    .json({ message: "User created via user router", data: req.body });
});

// ... other user-related routes (PUT, DELETE)

export default router; // Export the router instance
