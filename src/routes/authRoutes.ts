import { Router } from "express";
import { AuthService } from "../services/authServices";

const router = Router();

router.post("/register", AuthService.register);
router.post("/login", AuthService.login);
router.post("/refresh-token", AuthService.getRefreshToken);
export default router;
