import { Application, Assets } from "pixi.js";
import { Spine } from "pixi-spine";

export async function startSpineProbe(app: Application): Promise<Spine> {
  const source = "/assets/generated/spine/Slime/Slime";
  const resource = await Assets.load({
    src: `${source}.json`,
    data: { spineAtlasFile: `${source}.atlas` }
  });
  if (!resource.spineData) throw new Error("Slime spineData was not parsed");
  const slime = new Spine(resource.spineData);
  slime.position.set(400, 510);
  slime.scale.set(2);
  slime.state.setAnimation(0, "Walk", true);
  app.stage.addChild(slime);
  return slime;
}
