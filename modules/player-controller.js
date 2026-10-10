class BunerPlayerController {
    constructor(character) {
        this.character = character || null;
        this.movement = "idle";
        this.previousMovement = "";
        this.crouching = false;
        this.aiming = false;
        this.firing = false;
        this.animationSpeed = 1;
    }

    setCharacter(character) {
        this.character = character || null;
        this.previousMovement = "";
    }

    setMovement(movement) {
        const allowed = ["idle", "walk", "run", "jump", "shoot"];

        this.movement = allowed.includes(movement)
            ? movement
            : "idle";
    }

    setCrouching(value) {
        this.crouching = Boolean(value);
    }

    setAiming(value) {
        this.aiming = Boolean(value);
    }

    setFiring(value) {
        this.firing = Boolean(value);
    }

    update(delta) {
        if (!this.character || !Number.isFinite(delta)) return;

        const model = this.character;

        if (typeof model.update === "function") {
            model.update(Math.min(Math.max(delta, 0), 0.05));
        }

        if (
            this.movement !== this.previousMovement &&
            typeof model.playAnimation === "function"
        ) {
            const animation = this.firing
                ? "shoot"
                : this.movement;

            model.playAnimation(animation);
            this.previousMovement = this.movement;
        }
    }

    reset() {
        this.movement = "idle";
        this.previousMovement = "";
        this.crouching = false;
        this.aiming = false;
        this.firing = false;
    }
}

window.BunerPlayerController = BunerPlayerController;