import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets', 'models')
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30

MATERIALS = {}
def material(name, color, roughness=.5, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    MATERIALS[name] = mat
    return mat

gun = material('Gunmetal', (.075, .085, .08), .34, .78)
dark = material('DarkMetal', (.018, .024, .022), .42, .65)
edge = material('MachinedEdge', (.29, .32, .3), .28, .85)
polymer = material('Polymer', (.035, .043, .037), .7, .05)
olive = material('OliveChassis', (.19, .215, .16), .62, .12)
fabric = material('Fabric', (.055, .065, .058), .92, 0)
glove = material('GloveLeather', (.027, .032, .029), .7, 0)
armor = material('GloveArmor', (.11, .125, .105), .58, .2)
skin = material('Skin', (.5, .31, .21), .78, 0)
hair = material('Hair', (.018, .016, .014), .82, 0)
red = material('RedAccent', (.38, .07, .045), .48, .3)
blue = material('BlueAccent', (.08, .3, .35), .45, .35)
glass = material('Glass', (.3, .48, .45), .08, .1)
glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value = .16
glass.surface_render_method = 'DITHERED'
amber = material('AmberGlass', (.55, .25, .07), .18, .1)
amber.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value = .55
amber.surface_render_method = 'DITHERED'

def assign(obj, mat):
    obj.data.materials.append(mat)
    return obj

def smooth(obj):
    if obj.type == 'MESH':
        for polygon in obj.data.polygons: polygon.use_smooth = True
    return obj

def bevel(obj, amount=.008, segments=3):
    mod = obj.modifiers.new('Machined bevel', 'BEVEL')
    mod.width = amount; mod.segments = segments
    mod2 = obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    mod2.keep_sharp = True
    return obj

def empty(name, loc=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(obj)
    obj.location = loc
    if parent: obj.parent = parent
    return obj

def cube(name, loc, scale, mat, parent=None, bevel_width=.006):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object; obj.name = name; obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    if bevel_width: bevel(obj, bevel_width, 4)
    if parent: obj.parent = parent
    return obj

def uv(name, loc, scale, mat, parent=None, segments=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=loc)
    obj = bpy.context.object; obj.name = name; obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat); smooth(obj)
    if parent: obj.parent = parent
    return obj

def cylinder(name, loc, radius, depth, mat, parent=None, axis='Y', vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object; obj.name = name
    if axis == 'Y': obj.rotation_euler[0] = math.pi / 2
    if axis == 'X': obj.rotation_euler[1] = math.pi / 2
    assign(obj, mat); bevel(obj, .002, 2); smooth(obj)
    if parent: obj.parent = parent
    return obj

def tube(name, points, radius, mat, parent=None):
    curve = bpy.data.curves.new(name, 'CURVE'); curve.dimensions = '3D'; curve.resolution_u = 16
    curve.bevel_depth = radius; curve.bevel_resolution = 4
    spline = curve.splines.new('BEZIER'); spline.bezier_points.add(len(points) - 1)
    for p, co in zip(spline.bezier_points, points):
        p.co = co; p.handle_left_type = 'AUTO'; p.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve); bpy.context.collection.objects.link(obj); assign(obj, mat)
    if parent: obj.parent = parent
    return obj

def profile(name, points, width, mat, parent=None, bevel_width=.005):
    vertices = [(x, y, z) for x in (-width / 2, width / 2) for y, z in points]
    count = len(points)
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
    for i in range(count):
        j = (i + 1) % count
        faces.append((i, j, count + j, count + i))
    mesh = bpy.data.meshes.new(name); mesh.from_pydata(vertices, [], faces); mesh.update()
    obj = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(obj); assign(obj, mat)
    if bevel_width: bevel(obj, bevel_width, 3)
    if parent: obj.parent = parent
    return obj

def cut(obj, cutter):
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new('Through cut', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)

def join_remesh(objects, name, voxel=.007):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join(); obj = bpy.context.object; obj.name = name
    mod = obj.modifiers.new('Continuous surface', 'REMESH'); mod.mode = 'VOXEL'; mod.voxel_size = voxel
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new('Relaxed surface', 'SMOOTH'); mod.factor = 1.2; mod.iterations = 4
    bpy.ops.object.modifier_apply(modifier=mod.name)
    smooth(obj)
    return obj

def capsule(name, a, b, radius, mat, parent=None):
    a, b = Vector(a), Vector(b); delta = b - a
    obj = uv(name, (a + b) / 2, (radius, radius, delta.length / 2 + radius * .25), mat, parent, 24, 16)
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    return obj

def rail(parent, start, end, z, mat=gun):
    cube('RailBase', (0, (start + end) / 2, z), (.095, end - start, .025), dark, parent)
    count = int((end - start) / .038)
    for i in range(count + 1):
        cube('RailTooth', (0, start + i / count * (end - start), z + .018), (.11, .019, .016), mat, parent, .002)

def screws(parent, positions, radius=.009):
    for x, y, z in positions:
        cylinder('RecessedPin', (x, y, z), radius + .003, .006, dark, parent, 'X', 24)
        cylinder('TorxPin', (x * 1.04, y, z), radius, .008, edge, parent, 'X', 24)

def m7():
    root = empty('WeaponRig')
    profile('UpperReceiver', [(-.3, .02), (-.25, .12), (.36, .12), (.43, .065), (.38, -.025), (-.25, -.035)], .13, gun, root)
    profile('LowerReceiver', [(-.25, -.01), (.27, -.01), (.25, -.13), (.12, -.18), (-.04, -.19), (-.12, -.14), (-.25, -.1)], .115, gun, root)
    handguard = profile('Handguard', [(-.95, -.075), (-.98, .035), (-.92, .105), (-.29, .105), (-.26, .05), (-.29, -.07)], .145, gun, root)
    for i in range(5):
        cutter = cube('slot', (-.8 + i * .115, 0, 0), (.09, .3, .028), dark, None, 0)
        cut(handguard, cutter)
    for i in range(4):
        cutter = cube('slot', (-.74 + i * .12, 0, .067), (.075, .3, .016), dark, None, 0)
        cut(handguard, cutter)
    cylinder('InnerBarrel', (0, -.55, .015), .025, .82, dark, root)
    cylinder('Suppressor', (0, -1.27, .015), .054, .52, dark, root)
    for y in [-1.49, -1.4, -1.31, -1.22, -1.15]:
        cylinder('SuppressorRing', (0, y, .015), .056, .009, gun, root)
    rail(root, -.94, .39, .13)
    for side in [-1, 1]:
        cube('HandguardRail', (side * .08, -.6, -.07), (.022, .62, .03), dark, root)
        screws(root, [(side * .078, y, .01) for y in [-.88, -.34, -.2, .28]])
    mag = empty('Magazine', parent=root)
    profile('MagazineBody', [(-.18, -.14), (.015, -.14), (.025, -.44), (-.17, -.45), (-.2, -.29)], .1, polymer, mag)
    cube('MagazineFloor', (0, -.07, -.455), (.115, .21, .025), dark, mag)
    for z in [-.23, -.3, -.37]: cube('MagazineRib', (0, -.08, z), (.108, .15, .013), gun, mag, .002)
    profile('PistolGrip', [(.14, -.11), (.27, -.1), (.38, -.39), (.26, -.43), (.15, -.26)], .095, polymer, root)
    tube('TriggerGuard', [(0, .02, -.13), (0, .17, -.14), (0, .18, -.23), (0, .1, -.27), (0, .02, -.23), (0, .02, -.13)], .009, dark, root)
    cube('Trigger', (0, .08, -.19), (.018, .018, .075), edge, root)
    profile('Stock', [(.39, .08), (.86, .1), (.94, .04), (.92, -.28), (.79, -.28), (.56, -.1), (.5, -.04)], .12, polymer, root)
    cut(root.children[-1] if False else bpy.data.objects['Stock'], cylinder('StockCut', (0, .72, -.04), .13, .3, dark, None, 'X', 48))
    cube('ButtPad', (0, .94, -.08), (.15, .05, .34), polymer, root, .015)
    cube('CheekRest', (0, .69, .12), (.14, .36, .065), polymer, root, .012)
    cube('EjectionPort', (.073, .02, .035), (.014, .24, .06), dark, root)
    cube('BoltSurface', (.081, .02, .035), (.012, .18, .038), edge, root)
    cube('ChargingHandle', (.11, .18, .07), (.065, .09, .025), gun, root)
    sight = empty('RedDot', (0, .02, .17), root)
    cube('SightBase', (0, 0, 0), (.12, .12, .035), dark, sight)
    for x in [-.052, .052]: cube('SightSide', (x, 0, .065), (.016, .08, .11), dark, sight)
    cube('SightTop', (0, 0, .12), (.12, .08, .018), dark, sight)
    cube('SightGlass', (0, .04, .065), (.086, .003, .09), glass, sight, .002)
    uv('RedEmitter', (0, .043, .065), (.004, .002, .004), red, sight, 12, 8)
    front = empty('FrontSight', parent=root)
    cube('FrontPost', (0, -.86, .19), (.035, .04, .1), dark, front)
    muzzle = empty('Muzzle', (0, -1.52, .015), root)
    root['adsHeight'] = .235
    return root

def fluted_barrel(parent):
    radial = 64; rings = 56; vertices = []; faces = []
    for j in range(rings + 1):
        y = -.48 - j / rings * .72
        for i in range(radial + 1):
            angle = i / radial * math.pi * 2
            radius = .023 * (1 - .09 * ((math.sin(angle * 8) + 1) / 2) ** 4)
            vertices.append((math.cos(angle) * radius, y, .025 + math.sin(angle) * radius))
    for j in range(rings):
        for i in range(radial):
            a = j * (radial + 1) + i; b = a + radial + 1
            faces.append((a, b, b + 1, a + 1))
    mesh = bpy.data.meshes.new('FlutedBarrelMesh'); mesh.from_pydata(vertices, [], faces); mesh.update()
    obj = bpy.data.objects.new('FlutedMatchBarrel', mesh); bpy.context.collection.objects.link(obj); assign(obj, gun); smooth(obj); obj.parent = parent
    return obj

def awm_refine(root):
    fluted_barrel(root)
    mag = bpy.data.objects.get('Magazine')
    for side in [-1, 1]:
        for z in [-.16, -.21, -.26]: cube('MagazineGripRib', (side * .052, .07, z), (.009, .15, .008), edge, mag, .002)
        for y in [.72, .9]:
            cylinder('StockFastener', (side * .072, y, -.07), .012, .012, edge, root, 'X', 24)
        tube('StockLowerRail', [(side * .068, .44, -.22), (side * .068, .68, -.28), (side * .068, .88, -.24)], .008, gun, root)
        tube('FoldedBipod', [(side * .045, -.36, -.08), (side * .06, -.72, -.09), (side * .08, -.82, -.08)], .009, dark, root)
        uv('BipodFoot', (side * .08, -.82, -.08), (.018, .035, .015), polymer, root, 20, 12)
    scope = bpy.data.objects.get('Scope')
    for center, axis in [((0, .02, .067), 'Z'), ((.066, .02, 0), 'X')]:
        for i in range(32):
            a = i / 32 * math.pi * 2
            if axis == 'Z': loc = (math.cos(a) * .028, .02 + math.sin(a) * .028, .067)
            else: loc = (.066, .02 + math.cos(a) * .028, math.sin(a) * .028)
            cube('TurretKnurl', loc, (.004, .004, .06), edge, scope, .001)
    for y in [-.39, .34]:
        cylinder('CoatedScopeLens', (0, y, 0), .047, .003, glass, scope, 'Y', 64)
    for y in [-.22, .18]:
        for side in [-1, 1]: cube('ScopeMountClamp', (side * .035, y, -.08), (.018, .065, .035), gun, scope, .004)
    tube('ChassisSeam', [(-.063, -.35, -.065), (-.063, .1, -.065), (-.063, .3, -.04)], .0025, dark, root)
    tube('ChassisSeam', [(.063, -.35, -.065), (.063, .1, -.065), (.063, .3, -.04)], .0025, dark, root)
    for y in [.7, .76, .82, .88, .94]: cube('ButtPadGroove', (0, y, -.08), (.154, .012, .29), dark, root, .003)

def awm():
    root = empty('WeaponRig')
    chassis = profile('Chassis', [(-.42, -.04), (-.43, .07), (.3, .1), (.42, .04), (.35, -.08), (-.35, -.09)], .12, olive, root)
    cut(chassis, cube('ForendSlot', (0, -.12, .005), (.44, .3, .035), dark, None, .01))
    profile('Receiver', [(-.25, .06), (.31, .07), (.36, .015), (.26, -.07), (-.22, -.06)], .108, gun, root)
    cylinder('MatchBarrel', (0, -.82, .025), .023, .92, gun, root)
    for i in range(8): cylinder('BarrelRing', (0, -.48 - i * .09, .025), .025, .008, edge, root)
    cylinder('Suppressor', (0, -1.45, .025), .061, .46, dark, root)
    for y in [-1.67, -1.52, -1.36, -1.24]: cylinder('SuppressorRing', (0, y, .025), .063, .009, gun, root)
    rail(root, -.25, .34, .115)
    mag = empty('Magazine', parent=root)
    profile('MagazineBody', [(-.02, -.07), (.16, -.07), (.18, -.28), (0, -.31), (-.03, -.2)], .095, dark, mag)
    cube('MagazineFloor', (0, .08, -.3), (.11, .22, .025), polymer, mag)
    stock = profile('ThumbholeStock', [(.27, .03), (.43, .07), (.5, .1), (.93, .09), (1, .04), (1, -.25), (.82, -.27), (.62, -.32), (.42, -.22), (.32, -.12)], .125, olive, root)
    cut(stock, cylinder('Thumbhole', (0, .58, -.07), .145, .35, dark, None, 'X', 64))
    profile('PistolGrip', [(.28, -.07), (.38, -.06), (.47, -.3), (.36, -.36), (.27, -.21)], .09, olive, root)
    cube('ButtPad', (0, 1, -.08), (.15, .05, .32), polymer, root, .014)
    cube('CheekRest', (0, .78, .135), (.15, .36, .07), polymer, root, .014)
    for side in [-1, 1]: screws(root, [(side * .068, y, z) for y, z in [(-.31, .02), (.18, .02), (.4, .04), (.82, -.19), (.92, .04)]])
    scope = empty('Scope', (0, .02, .235), root)
    cylinder('ScopeTube', (0, 0, 0), .043, .47, dark, scope)
    cylinder('ObjectiveBell', (0, -.31, 0), .068, .18, dark, scope)
    cylinder('Eyepiece', (0, .28, 0), .055, .13, dark, scope)
    for y in [-.4, -.2, .2, .34]: cylinder('ScopeRing', (0, y, 0), .049 if y != -.4 else .071, .012, edge, scope)
    for y in [-.14, .16]: cube('ScopeMount', (0, y, -.09), (.04, .055, .13), edge, scope)
    cylinder('ElevationTurret', (0, .02, .067), .027, .075, dark, scope, 'Z', 40)
    cylinder('WindageTurret', (.066, .02, 0), .027, .075, dark, scope, 'X', 40)
    bolt = empty('BoltHandle', (0, .21, .055), root)
    cylinder('BoltBody', (0, 0, 0), .018, .23, edge, bolt)
    cylinder('BoltArm', (.095, .08, 0), .018, .13, edge, bolt, 'X', 32)
    uv('BoltKnob', (.16, .08, 0), (.032, .032, .032), dark, bolt)
    empty('Muzzle', (0, -1.7, .025), root)
    root['adsHeight'] = .235
    awm_refine(root)
    return root

def make_hand(side, parent, mat=glove):
    hand = empty('LeftHandRig' if side < 0 else 'RightHandRig', parent=parent)
    parts = [uv('Palm', (0, 0, 0), (.052, .075, .032), mat, hand)]
    for i in range(4):
        x = (i - 1.5) * .023
        a = (x, -.045, -.002); b = (x, -.09, -.025); c = (x, -.095, -.06)
        parts.append(capsule('FingerA', a, b, .012, mat, hand))
        parts.append(capsule('FingerB', b, c, .011, mat, hand))
    parts.append(capsule('Thumb', (-side * .048, .015, 0), (-side * .07, -.035, -.03), .015, mat, hand))
    joined = join_remesh(parts, 'ContinuousGlove', .0045)
    joined.parent = hand
    for i in range(4):
        uv('KnuckleGuard', ((i - 1.5) * .024, -.035, .032), (.014, .022, .009), armor, hand, 20, 12)
    for y in [.005, .028, .05]: tube('GloveStitch', [(-.035, y, .031), (0, y + .003, .035), (.035, y, .031)], .0015, fabric, hand)
    return hand

def add_fps(root, weapon_id):
    left = make_hand(-1, root); right = make_hand(1, root)
    left.location = (.15, .52 if weapon_id == 'm7' else .34, -.17)
    right.location = (-.28, -.26, -.28)
    left.scale = (1.3, 1.3, 1.3); right.scale = (1.35, 1.35, 1.35)
    capsule('LeftForearm', (-.2, -.16, -.28), (0, 0, 0), .047, fabric, left)
    capsule('RightForearm', (.22, .18, -.28), (0, 0, 0), .046, fabric, right)
    return left, right

def key(obj, frame, loc=None, rot=None):
    if loc is not None: obj.location = loc; obj.keyframe_insert('location', frame=frame)
    if rot is not None: obj.rotation_euler = rot; obj.keyframe_insert('rotation_euler', frame=frame)

def finish_action(objects, name):
    for obj in objects:
        if obj.animation_data and obj.animation_data.action:
            obj.animation_data.action.name = name

def animate_reload(root, left, mag, weapon_id):
    duration = 68 if weapon_id == 'm7' else 102
    for frame, angle, drop in [(1, 0, 0), (10, -.34, .03), (22, -.48, .08), (32, -.38, .06), (int(duration * .68), -.3, .04), (duration, 0, 0)]:
        key(root, frame, (0, 0, drop), (angle, -.12, -.18))
    base = tuple(mag.location)
    for frame, offset in [(1, (0, 0, 0)), (12, (0, 0, 0)), (23, (-.06, -.02, -.32)), (34, (-.1, -.04, -.38)), (int(duration * .62), (0, 0, 0)), (duration, (0, 0, 0))]:
        key(mag, frame, tuple(base[i] + offset[i] for i in range(3)))
    left_base = tuple(left.location)
    for frame, offset in [(1, (0, 0, 0)), (10, (0, 0, 0)), (22, (-.08, -.08, -.28)), (34, (-.13, -.14, -.36)), (int(duration * .68), (0, 0, 0)), (duration, (0, 0, 0))]:
        key(left, frame, tuple(left_base[i] + offset[i] for i in range(3)))
    finish_action([root, left, mag], 'Reload')

def animate_bolt(bolt, right):
    base = tuple(bolt.location); right_base = tuple(right.location)
    for frame, lift, pull in [(1, 0, 0), (7, -.72, 0), (13, -.72, .16), (20, -.72, .16), (27, 0, 0), (34, 0, 0)]:
        key(bolt, frame, (base[0], base[1] + pull, base[2]), (0, lift, 0))
        key(right, frame, (right_base[0] + pull * .5, right_base[1] + pull, right_base[2]))
    finish_action([bolt, right], 'Bolt')

def select_export(objects, filename, animation=False):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
        for child in obj.children_recursive: child.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, filename), use_selection=True, export_format='GLB', export_animations=animation, export_frame_range=True, export_force_sampling=True)

def descendants(root):
    return [root] + list(root.children_recursive)

for weapon_id, factory in [('m7', m7), ('awm', awm)]:
    root = factory()
    select_export([root], f'{weapon_id}.glb')
    left, right = add_fps(root, weapon_id)
    mag = bpy.data.objects['Magazine']
    animate_reload(root, left, mag, weapon_id)
    if weapon_id == 'awm': animate_bolt(bpy.data.objects['BoltHandle'], right)
    select_export([root], f'{weapon_id}_fps.glb', True)
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

# Organic operator assets with named joint hierarchy.
def operator(operator_id):
    root = empty('OperatorRoot'); visual = empty('Visual', parent=root)
    hips = empty('Hips', (0, 0, .96), visual)
    torso = empty('Torso', (0, 0, .08), hips)
    is_luna = operator_id == 'luna'; is_red = operator_id == 'redwolf'
    cloth = fabric if not is_luna else olive
    body_mat = skin if is_luna else cloth
    profile('TorsoArmor', [(-.15, -.12), (.15, -.12), (.23, .4), (.16, .55), (-.16, .55), (-.23, .4)], .28 if not is_luna else .24, cloth, torso, .03)
    cube('PlateCarrier', (0, -.17, .24), (.43 if not is_luna else .37, .12, .42), olive if is_luna else dark, torso, .035)
    for x in [-.13, 0, .13]: cube('MagazinePouch', (x, -.245, .06), (.11, .09, .16), fabric, torso, .015)
    cube('Belt', (0, 0, 0), (.41, .28, .075), dark, hips, .012)
    head = empty('Head', (0, 0, .72), torso)
    face = [uv('Cranium', (0, 0, .02), (.13, .125, .17), skin, head), uv('Jaw', (0, -.03, -.07), (.105, .1, .1), skin, head), uv('Nose', (0, -.13, 0), (.025, .04, .04), skin, head)]
    join_remesh(face, 'Face', .003).parent = head
    for side in [-1, 1]:
        uv('Ear', (side * .13, 0, 0), (.025, .018, .04), skin, head)
        uv('Eye', (side * .052, -.119, .035), (.025, .008, .012), dark, head, 20, 12)
        tube('Brow', [(side * .025, -.122, .065), (side * .052, -.126, .073), (side * .08, -.116, .065)], .006, hair, head)
    tube('Lips', [(-.035, -.126, -.065), (0, -.132, -.07), (.035, -.126, -.065)], .004, red if is_luna else hair, head)
    for side, prefix in [(-1, 'Left'), (1, 'Right')]:
        arm = empty(f'{prefix}Shoulder', (side * (.31 if is_luna else .36), 0, .45), torso)
        capsule('UpperArm', (0, 0, 0), (0, 0, -.34), .09 if not is_luna else .068, body_mat, arm)
        elbow = empty(f'{prefix}Elbow', (0, 0, -.36), arm)
        capsule('Forearm', (0, 0, 0), (0, 0, -.31), .07 if not is_luna else .058, body_mat, elbow)
        make_hand(side, elbow).location = (0, 0, -.36)
        if is_red:
            cube('ExoUpper', (side * .09, 0, -.17), (.055, .09, .28), edge, arm, .012)
            cube('ExoLower', (side * .075, 0, -.16), (.05, .08, .25), edge, elbow, .01)
        hip = empty(f'{prefix}Hip', (side * .15, 0, 0), hips)
        capsule('Thigh', (0, 0, 0), (0, 0, -.42), .12, cloth, hip)
        knee = empty(f'{prefix}Knee', (0, 0, -.45), hip)
        capsule('Shin', (0, 0, 0), (0, 0, -.4), .09, cloth, knee)
        cube('KneePad', (0, -.085, -.02), (.17, .08, .16), dark, knee, .025)
        cube('Boot', (0, -.07, -.47), (.17, .29, .15), dark, knee, .03)
    if operator_id == 'vyron':
        uv('Helmet', (0, .015, .1), (.155, .15, .12), olive, head)
        cube('Balaclava', (0, -.1, -.08), (.22, .08, .14), fabric, head, .03)
        cube('NVGMount', (0, -.12, .19), (.08, .07, .08), dark, head)
        for side in [-1, 1]:
            cylinder('NVGTube', (side * .055, -.1, .32), .035, .13, edge, head, 'Z', 32)
        cube('Goggles', (0, -.14, .04), (.24, .025, .07), amber, head, .012)
    elif is_luna:
        uv('HairCap', (0, .04, .1), (.145, .14, .1), hair, head)
        capsule('Ponytail', (0, .12, .12), (0, .24, -.18), .055, hair, head)
        cylinder('Quiver', (-.15, .26, .25), .07, .55, dark, torso, 'Z', 32)
        for i in range(4): cylinder('Arrow', (-.18 + i * .025, .26, .62), .005, .75, blue, torso, 'Z', 12)
    else:
        uv('Cap', (0, .03, .12), (.15, .14, .09), dark, head)
        cube('CapBrim', (0, -.16, .09), (.2, .18, .025), dark, head, .012)
        uv('Beard', (0, -.09, -.1), (.105, .07, .065), hair, head)
        cube('AmberGlasses', (0, -.14, .035), (.25, .02, .06), amber, head, .012)
        for side in [-1, 1]: cylinder('Headset', (side * .16, 0, .02), .05, .04, dark, head, 'X', 32)
    root['operator'] = operator_id
    return root

for op in ['vyron', 'luna', 'redwolf']:
    root = operator(op)
    select_export([root], f'{op}.glb')
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

print('Blender assets exported to', OUT)
